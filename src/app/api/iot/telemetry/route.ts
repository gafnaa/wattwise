import { NextResponse } from "next/server";
import { z } from "zod";
import { hashDeviceApiKey, timingSafeEqualHex } from "@/lib/auth";
import {
  calculateCostIdr,
  calculateEnergyKwhFromPower,
} from "@/lib/audit/calculator";
import {
  formatTelegramUrgentAlert,
  shouldTriggerUrgentIdleAlert,
} from "@/lib/audit/recommendations";
import { calculateVirtualSensorPower } from "@/lib/audit/virtual-sensor";
import { db } from "@/lib/db";
import { classifyTelemetryWindow } from "@/lib/ml/classifier";
import type { HysteresisState, PowerSample } from "@/lib/ml/types";
import { sendTelegramMessage } from "@/lib/telegram/bot";

/**
 * Mendukung 2 format payload ESP32:
 * 1) Format ringkas 3-kolom hardware (index, timestamp, daya / power_w)
 * 2) Format lengkap PZEM-004T (`metrics: { voltage_v, current_a, power_w, ... }`)
 */
const telemetryItemSchema = z.object({
  device_uid: z.string().min(1).optional(),
  index: z.number().int().optional(),
  sample_index: z.number().int().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  recorded_at: z.union([z.string(), z.number()]).optional(),
  daya: z.number().nonnegative().optional(),
  power_w: z.number().nonnegative().optional(),
  firmware_version: z.string().optional(),
  is_simulated: z.boolean().optional(),
  metrics: z
    .object({
      voltage_v: z.number().nonnegative().optional(),
      current_a: z.number().nonnegative().optional(),
      power_w: z.number().nonnegative(),
      energy_kwh: z.number().nonnegative().optional(),
      frequency_hz: z.number().nonnegative().optional(),
      power_factor: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const telemetryBodySchema = z.union([
  telemetryItemSchema,
  z.object({
    device_uid: z.string().min(1).optional(),
    readings: z.array(telemetryItemSchema).min(1).max(100),
  }),
]);

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

    const items =
      "readings" in parsed.data ? parsed.data.readings : [parsed.data];

    const deviceUid =
      request.headers.get("x-device-uid") ??
      ("device_uid" in parsed.data ? parsed.data.device_uid : undefined) ??
      items[0]?.device_uid;
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

    // Update heartbeat ESP32
    await db.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        firmwareVersion: items[0]?.firmware_version ?? device.firmwareVersion,
      },
    });

    const processedResults: Array<{
      recordedAt: string;
      powerW: number;
      status: string;
      confidence: number;
      virtualPowerW?: number;
      urgentAlertSent?: boolean;
    }> = [];

    for (const item of items) {
      const powerW = item.metrics?.power_w ?? item.power_w ?? item.daya;
      if (typeof powerW !== "number") {
        continue;
      }

      const tsInput = item.recorded_at ?? item.timestamp;
      const recordedAt = tsInput ? new Date(tsInput) : new Date();
      const sampleIndex = item.sample_index ?? item.index ?? null;

      // Jalur 1: Node Meter Induk PLN -> hitung Virtual Sensor agregat
      if (device.isMainMeter) {
        const [virtualMachine, priorityMachines] = await Promise.all([
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

        if (virtualMachine) {
          const virtualStatus = vs.virtualPowerW < 25 ? "OFF" : "WORKING";
          await db.telemetryReading.create({
            data: {
              deviceId: device.id,
              machineId: virtualMachine.id,
              sampleIndex,
              recordedAt,
              powerW: vs.virtualPowerW,
              voltageV: item.metrics?.voltage_v ?? null,
              currentA: item.metrics?.current_a ?? null,
              energyKwh: item.metrics?.energy_kwh ?? null,
              frequencyHz: item.metrics?.frequency_hz ?? null,
              powerFactor: item.metrics?.power_factor ?? null,
              predictedStatus: virtualStatus,
              statusConfidence: 1.0,
              isSimulated: Boolean(item.is_simulated),
            },
          });
        }

        processedResults.push({
          recordedAt: recordedAt.toISOString(),
          powerW,
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

      const [recentReadings, openSession] = await Promise.all([
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

      const windowSamples: PowerSample[] = [
        ...recentReadings.reverse().map((r) => ({
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
          voltageV: item.metrics?.voltage_v ?? null,
          currentA: item.metrics?.current_a ?? null,
          powerFactor: item.metrics?.power_factor ?? null,
        },
      ];

      const prevHysteresis: HysteresisState | undefined = openSession
        ? {
            stableStatus: openSession.status,
            pendingIdleCount:
              openSession.status === "WORKING" &&
              recentReadings[recentReadings.length - 1]?.predictedStatus ===
                "IDLE"
                ? 1
                : 0,
          }
        : undefined;

      const { result: classification } = classifyTelemetryWindow({
        windowSamples,
        ratedPowerW: machine.ratedPowerW,
        prevHysteresisState: prevHysteresis,
      });

      const dtSec = Math.max(1, Math.round(classification.features.dtSec));
      const deltaKwh = calculateEnergyKwhFromPower(powerW, dtSec);

      await db.telemetryReading.create({
        data: {
          deviceId: device.id,
          machineId: machine.id,
          sampleIndex,
          recordedAt,
          powerW,
          voltageV: item.metrics?.voltage_v ?? null,
          currentA: item.metrics?.current_a ?? null,
          energyKwh: item.metrics?.energy_kwh ?? deltaKwh,
          frequencyHz: item.metrics?.frequency_hz ?? null,
          powerFactor: item.metrics?.power_factor ?? null,
          predictedStatus: classification.status,
          statusConfidence: classification.confidence,
          isSimulated: Boolean(item.is_simulated),
        },
      });

      // Update atau buka MachineStateSession baru
      let currentIdleDurationMin = 0;
      let currentSessionLossIdr = 0;

      if (openSession && openSession.status === classification.status) {
        const nextDurationSec = openSession.durationSec + dtSec;
        const nextEnergyKwh = Number(
          (openSession.energyKwh + deltaKwh).toFixed(6)
        );
        const nextAvgPowerW = Number(
          (
            (openSession.avgPowerW * openSession.durationSec + powerW * dtSec) /
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
          await db.machineStateSession.update({
            where: { id: openSession.id },
            data: { endedAt: recordedAt },
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
        status: classification.status,
        confidence: classification.confidence,
        urgentAlertSent,
      });
    }

    return NextResponse.json({
      ok: true,
      deviceUid,
      processedCount: processedResults.length,
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
