import { NextResponse } from "next/server";
import { calculateCostIdr } from "@/lib/audit/calculator";
import {
  formatTelegramUrgentAlert,
  shouldTriggerUrgentIdleAlert,
} from "@/lib/audit/recommendations";
import { calculateVirtualSensorPower } from "@/lib/audit/virtual-sensor";
import { hashDeviceApiKey, timingSafeEqualHex } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  computeIntervalAccounting,
  isPrismaUniqueConstraintError,
  normalizeAndDedupeTelemetryBatch,
} from "@/lib/iot/ingestion";
import { telemetryBodySchema } from "@/lib/iot/telemetry-schema";
import { classifyTelemetryWindow } from "@/lib/ml/classifier";
import type { HysteresisState, PowerSample } from "@/lib/ml/types";
import { sendTelegramMessage } from "@/lib/telegram/bot";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = telemetryBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Payload telemetri tidak valid",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const rawItems =
      "readings" in parsed.data ? parsed.data.readings : [parsed.data];

    const deviceUid =
      request.headers.get("x-device-uid") ??
      ("device_uid" in parsed.data ? parsed.data.device_uid : undefined) ??
      rawItems[0]?.device_uid;
    const rawApiKey = request.headers.get("x-api-key");

    if (!deviceUid || !rawApiKey) {
      return NextResponse.json(
        {
          error:
            "Header X-Device-UID dan X-API-Key wajib disertakan oleh node ESP32.",
        },
        { status: 401 }
      );
    }

    const device = await db.device.findUnique({
      where: { deviceUid },
      include: {
        workshop: true,
        machine: true,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: `Device '${deviceUid}' tidak terdaftar.` },
        { status: 404 }
      );
    }

    const incomingHash = hashDeviceApiKey(rawApiKey);
    if (!timingSafeEqualHex(incomingHash, device.apiKeyHash)) {
      return NextResponse.json(
        { error: "API key perangkat tidak valid." },
        { status: 401 }
      );
    }

    const now = new Date();
    const tariffIdr = Number(device.workshop.tariffIdrPerKwh);

    const { items, intraBatchDuplicates } = normalizeAndDedupeTelemetryBatch(
      rawItems,
      now.getTime()
    );

    // Update heartbeat ESP32
    await db.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        firmwareVersion:
          items[0]?.firmwareVersion ??
          rawItems[0]?.firmware_version ??
          device.firmwareVersion,
      },
    });

    let skippedDuplicates = intraBatchDuplicates;
    let skippedOutOfOrder = 0;

    const processedResults: Array<{
      recordedAt: string;
      powerW: number;
      deltaKwh?: number;
      accountingDtSec?: number;
      energySource?: string;
      status: string;
      confidence: number;
      virtualPowerW?: number;
      urgentAlertSent?: boolean;
    }> = [];

    for (const item of items) {
      const {
        recordedAt,
        sampleIndex,
        powerW,
        voltageV,
        currentA,
        cumulativeEnergyKwh,
        frequencyHz,
        powerFactor,
        isSimulated,
      } = item;

      // Cek deduplikasi tingkat database per (deviceId, recordedAt)
      const existingSameTimestamp = await db.telemetryReading.findUnique({
        where: {
          deviceId_recordedAt: {
            deviceId: device.id,
            recordedAt,
          },
        },
        select: { id: true },
      });

      if (existingSameTimestamp) {
        skippedDuplicates++;
        continue;
      }

      // Jalur 1: Node Meter Induk PLN -> hitung Virtual Sensor agregat
      if (device.isMainMeter) {
        const [virtualMachine, priorityMachines, prevMainReading] =
          await Promise.all([
            db.machine.findFirst({
              where: {
                workshopId: device.workshopId,
                hasPhysicalSensor: false,
              },
            }),
            db.machine.findMany({
              where: {
                workshopId: device.workshopId,
                hasPhysicalSensor: true,
                isActive: true,
              },
              include: {
                telemetryReadings: {
                  orderBy: { recordedAt: "desc" },
                  take: 1,
                },
              },
            }),
            db.telemetryReading.findFirst({
              where: { deviceId: device.id },
              orderBy: { recordedAt: "desc" },
              select: {
                recordedAt: true,
                powerW: true,
                cumulativeEnergyKwh: true,
              },
            }),
          ]);

        const prioritySnapshots = priorityMachines
          .filter((m) => m.telemetryReadings[0])
          .map((m) => ({
            machineId: m.id,
            machineCode: m.code,
            powerW: m.telemetryReadings[0].powerW,
            recordedAt: m.telemetryReadings[0].recordedAt,
          }));

        const vs = calculateVirtualSensorPower({
          mainMeterPowerW: powerW,
          mainMeterRecordedAt: recordedAt,
          priorityReadings: prioritySnapshots,
        });

        const mainAccounting = computeIntervalAccounting({
          prevReading: prevMainReading,
          currRecordedAt: recordedAt,
          currPowerW: vs.virtualPowerW,
          currCumulativeEnergyKwh: null, // Virtual load dihitung dari daya selisih
          ratedPowerW: Math.max(virtualMachine?.ratedPowerW ?? 2000, 2000),
        });

        if (mainAccounting.shouldSkip) {
          if (mainAccounting.kind === "OUT_OF_ORDER") {
            skippedOutOfOrder++;
          } else {
            skippedDuplicates++;
          }
          continue;
        }

        if (virtualMachine) {
          const virtualStatus = vs.virtualPowerW < 25 ? "OFF" : "WORKING";
          try {
            await db.telemetryReading.create({
              data: {
                deviceId: device.id,
                machineId: virtualMachine.id,
                sampleIndex,
                recordedAt,
                powerW: vs.virtualPowerW,
                voltageV,
                currentA,
                energyKwh: mainAccounting.deltaKwh,
                cumulativeEnergyKwh,
                frequencyHz,
                powerFactor,
                predictedStatus: virtualStatus,
                statusConfidence: 1.0,
                isSimulated,
              },
            });
          } catch (err) {
            if (isPrismaUniqueConstraintError(err)) {
              skippedDuplicates++;
              continue;
            }
            throw err;
          }
        }

        processedResults.push({
          recordedAt: recordedAt.toISOString(),
          powerW,
          deltaKwh: mainAccounting.deltaKwh,
          accountingDtSec: mainAccounting.accountingDtSec,
          energySource: mainAccounting.energySource,
          status: "MAIN_METER",
          confidence: 1.0,
          virtualPowerW: vs.virtualPowerW,
        });
        continue;
      }

      // Jalur 2: Node Sensor Mesin Prioritas -> Random Forest + State Session + Alert
      const machine = device.machine;
      if (!machine) {
        continue;
      }

      const [recentReadingsDesc, openSession] = await Promise.all([
        db.telemetryReading.findMany({
          where: { machineId: machine.id },
          orderBy: { recordedAt: "desc" },
          take: 4,
        }),
        db.machineStateSession.findFirst({
          where: { machineId: machine.id, endedAt: null },
          orderBy: { startedAt: "desc" },
        }),
      ]);

      const latestPreviousReading = recentReadingsDesc[0] ?? null;

      // Hitung durasi aktual, deteksi gap koneksi, & energi delta terpisah dari clamp ML 60 detik
      const accounting = computeIntervalAccounting({
        prevReading: latestPreviousReading
          ? {
              recordedAt: latestPreviousReading.recordedAt,
              powerW: latestPreviousReading.powerW,
              cumulativeEnergyKwh: latestPreviousReading.cumulativeEnergyKwh,
            }
          : null,
        currRecordedAt: recordedAt,
        currPowerW: powerW,
        currCumulativeEnergyKwh: cumulativeEnergyKwh,
        ratedPowerW: machine.ratedPowerW,
      });

      if (accounting.shouldSkip) {
        if (accounting.kind === "OUT_OF_ORDER") {
          skippedOutOfOrder++;
        } else {
          skippedDuplicates++;
        }
        continue;
      }

      const recentReadingsAsc = [...recentReadingsDesc].reverse();

      const windowSamples: PowerSample[] = [
        ...recentReadingsAsc.map((r) => ({
          sampleIndex: r.sampleIndex,
          recordedAt: r.recordedAt,
          powerW: r.powerW,
          voltageV: r.voltageV,
          currentA: r.currentA,
          powerFactor: r.powerFactor,
        })),
        {
          sampleIndex,
          recordedAt,
          powerW,
          voltageV,
          currentA,
          powerFactor,
        },
      ];

      // Jika terdeteksi gap koneksi panjang, reset hysteresis agar status baru bersih
      const prevHysteresis: HysteresisState | undefined =
        openSession && !accounting.sessionGapDetected
          ? {
              stableStatus: openSession.status,
              pendingIdleCount:
                openSession.status === "WORKING" &&
                recentReadingsAsc[recentReadingsAsc.length - 1]
                  ?.predictedStatus === "IDLE"
                  ? 1
                  : 0,
            }
          : undefined;

      const { result: classification } = classifyTelemetryWindow({
        windowSamples,
        ratedPowerW: machine.ratedPowerW,
        prevHysteresisState: prevHysteresis,
      });

      const dtSec = Math.max(1, Math.round(accounting.accountingDtSec));
      const deltaKwh = accounting.deltaKwh;

      try {
        await db.telemetryReading.create({
          data: {
            deviceId: device.id,
            machineId: machine.id,
            sampleIndex,
            recordedAt,
            powerW,
            voltageV,
            currentA,
            energyKwh: deltaKwh, // Selalu energi delta per interval (kWh)
            cumulativeEnergyKwh, // Selalu meter kumulatif mentah PZEM (opsional)
            frequencyHz,
            powerFactor,
            predictedStatus: classification.status,
            statusConfidence: classification.confidence,
            isSimulated,
          },
        });
      } catch (err) {
        // Guard race condition apabila dua request retry ESP32 tiba paralel
        if (isPrismaUniqueConstraintError(err)) {
          skippedDuplicates++;
          continue;
        }
        throw err;
      }

      // Update atau buka MachineStateSession baru dengan penanganan gap koneksi
      let currentIdleDurationMin = 0;
      let currentSessionLossIdr = 0;

      const canContinueOpenSession =
        Boolean(openSession) &&
        !accounting.sessionGapDetected &&
        openSession!.status === classification.status;

      if (canContinueOpenSession && openSession) {
        const nextDurationSec = openSession.durationSec + dtSec;
        const nextEnergyKwh = Number(
          (openSession.energyKwh + deltaKwh).toFixed(6)
        );
        const nextAvgPowerW = Number(
          (
            (openSession.avgPowerW * openSession.durationSec +
              accounting.intervalAvgPowerW * dtSec) /
            Math.max(1, nextDurationSec)
          ).toFixed(1)
        );
        const nextCostIdr = calculateCostIdr(nextEnergyKwh, tariffIdr);

        await db.machineStateSession.update({
          where: { id: openSession.id },
          data: {
            durationSec: nextDurationSec,
            avgPowerW: nextAvgPowerW,
            energyKwh: nextEnergyKwh,
            costIdr: nextCostIdr,
          },
        });

        currentIdleDurationMin = nextDurationSec / 60;
        currentSessionLossIdr = nextCostIdr;
      } else {
        if (openSession) {
          // Saat gap koneksi, tutup sesi lama di timestamp sampel terakhir sebelum offline
          const closeAt =
            accounting.sessionGapDetected && latestPreviousReading
              ? latestPreviousReading.recordedAt
              : recordedAt;

          await db.machineStateSession.update({
            where: { id: openSession.id },
            data: { endedAt: closeAt },
          });
        }

        const initCostIdr = calculateCostIdr(deltaKwh, tariffIdr);
        await db.machineStateSession.create({
          data: {
            machineId: machine.id,
            status: classification.status,
            startedAt: recordedAt,
            endedAt: null,
            durationSec: dtSec,
            avgPowerW: powerW,
            energyKwh: deltaKwh,
            costIdr: initCostIdr,
          },
        });
        currentIdleDurationMin = dtSec / 60;
        currentSessionLossIdr = initCostIdr;
      }

      // Cek ambang alert urgent Telegram dengan cooldown 30 menit
      let urgentAlertSent = false;
      if (classification.status === "IDLE") {
        const lastAlert = await db.telegramNotification.findFirst({
          where: {
            machineId: machine.id,
            notificationType: "URGENT_IDLE",
          },
          orderBy: { sentAt: "desc" },
        });

        const shouldAlert = shouldTriggerUrgentIdleAlert({
          machineStatus: classification.status,
          idleDurationMin: currentIdleDurationMin,
          idleAlertThresholdMin: machine.idleAlertThresholdMin,
          lastAlertSentAt: lastAlert?.sentAt ?? null,
          now: recordedAt,
          cooldownMin: 30,
        });

        if (shouldAlert) {
          const messageBody = formatTelegramUrgentAlert({
            workshopName: device.workshop.name,
            machineName: machine.name,
            idleDurationMin: currentIdleDurationMin,
            currentPowerW: powerW,
            estimatedLossThisSessionIdr: currentSessionLossIdr,
            dashboardUrl: process.env.NEXT_PUBLIC_APP_URL
              ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
              : undefined,
          });

          const tgRes = await sendTelegramMessage({
            chatId: device.workshop.telegramChatId,
            text: messageBody,
          });

          await db.telegramNotification.create({
            data: {
              workshopId: device.workshopId,
              machineId: machine.id,
              notificationType: "URGENT_IDLE",
              messageBody,
              deliveryStatus: tgRes.ok ? "SENT" : "FAILED",
            },
          });

          urgentAlertSent = tgRes.ok;
        }
      }

      processedResults.push({
        recordedAt: recordedAt.toISOString(),
        powerW,
        deltaKwh,
        accountingDtSec: dtSec,
        energySource: accounting.energySource,
        status: classification.status,
        confidence: classification.confidence,
        urgentAlertSent,
      });
    }

    return NextResponse.json({
      ok: true,
      deviceUid,
      processedCount: processedResults.length,
      skippedDuplicates,
      skippedOutOfOrder,
      results: processedResults,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Gagal memproses telemetri IoT.",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
