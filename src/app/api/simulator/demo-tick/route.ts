import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateEnergyKwhFromPower } from "@/lib/audit/calculator";
import { calculateVirtualSensorPower } from "@/lib/audit/virtual-sensor";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classifyTelemetryWindow } from "@/lib/ml/classifier";
import type { PowerSample } from "@/lib/ml/types";
import { INITIAL_MACHINES } from "@/lib/mock-dashboard-data";

const demoTickSchema = z
  .object({
    scenario: z
      .enum(["normal", "high_idle", "peak_production"])
      .optional()
      .default("normal"),
    persist: z.boolean().optional().default(true),
  })
  .optional();

function generateScenarioPowerWindow(
  ratedPowerW: number,
  baselineIdleW: number,
  baselineWorkingW: number,
  targetMode: "WORKING" | "IDLE" | "OFF",
  nowMs: number
): PowerSample[] {
  const samples: PowerSample[] = [];
  for (let i = 4; i >= 0; i--) {
    const ts = nowMs - i * 2000;
    let powerW = 3;
    if (targetMode === "WORKING") {
      const wave = Math.sin((5 - i) * 1.2) * 0.08 * ratedPowerW;
      powerW = Math.max(
        ratedPowerW * 0.55,
        baselineWorkingW + wave + (Math.random() - 0.5) * 0.08 * ratedPowerW
      );
    } else if (targetMode === "IDLE") {
      powerW = baselineIdleW * (1 + (Math.random() - 0.5) * 0.02);
    }
    samples.push({
      sampleIndex: 5 - i,
      recordedAt: ts,
      powerW: Number(Math.max(0, powerW).toFixed(1)),
    });
  }
  return samples;
}

/**
 * Memicu satu siklus simulasi realistis 6 mesin furnitur + Meter Induk
 * langsung melewati pipeline Random Forest + Virtual Sensor (berguna untuk
 * pengujian end-to-end dan demo Hackathon tanpa hardware tersambung penuh).
 */
export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth();
  if (authError) return authError;

  const rawBody = await request.json().catch(() => ({}));
  const parsed = demoTickSchema.safeParse(rawBody);
  const scenario = parsed.success ? (parsed.data?.scenario ?? "normal") : "normal";
  const persist = parsed.success ? (parsed.data?.persist ?? true) : true;

  const now = new Date();
  const nowMs = now.getTime();

  const pickMode = (
    code: string,
    defaultStatus: string
  ): "WORKING" | "IDLE" | "OFF" => {
    if (scenario === "high_idle") {
      return code === "COMP-5HP" ? "OFF" : "IDLE";
    }
    if (scenario === "peak_production") {
      return "WORKING";
    }
    if (defaultStatus === "WORKING" || defaultStatus === "IDLE") {
      return defaultStatus;
    }
    return "OFF";
  };

  let persistedCount = 0;
  let dataSource: "database" | "demo" = "demo";
  const results: Array<{
    code: string;
    name: string;
    powerW: number;
    predictedStatus: string;
    confidence: number;
  }> = [];

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (workshop && persist) {
      const machinesDb = await db.machine.findMany({
        where: { workshopId: workshop.id, isActive: true },
        include: { device: true },
        orderBy: { createdAt: "asc" },
      });

      const priorityMachines = machinesDb.filter((m) => m.hasPhysicalSensor);
      const virtualMachine = machinesDb.find((m) => !m.hasPhysicalSensor);

      if (priorityMachines.length > 0) {
        dataSource = "database";
        const prioritySnapshots = [];

        for (const m of priorityMachines) {
          const fallbackSpec = INITIAL_MACHINES.find((im) => im.code === m.code);
          const mode = pickMode(m.code, fallbackSpec?.status ?? "IDLE");
          const win = generateScenarioPowerWindow(
            m.ratedPowerW,
            m.baselineIdleW,
            m.baselineWorkingW,
            mode,
            nowMs
          );
          const { result } = classifyTelemetryWindow({
            windowSamples: win,
            ratedPowerW: m.ratedPowerW,
          });
          const latest = win[win.length - 1];

          await db.telemetryReading.create({
            data: {
              deviceId: m.device?.id ?? null,
              machineId: m.id,
              sampleIndex: latest.sampleIndex ?? 1,
              recordedAt: now,
              powerW: latest.powerW,
              energyKwh: calculateEnergyKwhFromPower(latest.powerW, 2),
              predictedStatus: result.status,
              statusConfidence: result.confidence,
              isSimulated: true,
            },
          });

          if (m.device) {
            await db.device.update({
              where: { id: m.device.id },
              data: { lastSeenAt: now },
            });
          }

          persistedCount++;
          prioritySnapshots.push({
            machineId: m.id,
            machineCode: m.code,
            powerW: latest.powerW,
            recordedAt: now,
          });
          results.push({
            code: m.code,
            name: m.name,
            powerW: latest.powerW,
            predictedStatus: result.status,
            confidence: result.confidence,
          });
        }

        const prioritySum = prioritySnapshots.reduce((s, r) => s + r.powerW, 0);
        const virtualOverhead = 520 + Math.round(Math.random() * 240);
        const vs = calculateVirtualSensorPower({
          mainMeterPowerW: prioritySum + virtualOverhead,
          mainMeterRecordedAt: now,
          priorityReadings: prioritySnapshots,
        });

        if (virtualMachine) {
          await db.telemetryReading.create({
            data: {
              machineId: virtualMachine.id,
              recordedAt: now,
              powerW: vs.virtualPowerW,
              predictedStatus: vs.virtualPowerW > 25 ? "WORKING" : "OFF",
              statusConfidence: 1.0,
              isSimulated: true,
            },
          });
        }

        return NextResponse.json({
          ok: true,
          dataSource,
          scenario,
          recordedAt: now.toISOString(),
          persistedCount,
          virtualSensor: vs,
          machines: results,
        });
      }
    }
  } catch {
    // Fallback ke eksekusi in-memory (tetap lewat Random Forest & Virtual Sensor nyata)
  }

  const prioritySnapshots = [];
  for (const m of INITIAL_MACHINES) {
    const mode = pickMode(m.code, m.status);
    const win = generateScenarioPowerWindow(
      m.ratedPowerW,
      m.baselineIdleW,
      m.baselineWorkingW,
      mode,
      nowMs
    );
    const { result } = classifyTelemetryWindow({
      windowSamples: win,
      ratedPowerW: m.ratedPowerW,
    });
    const latest = win[win.length - 1];
    prioritySnapshots.push({
      machineId: m.id,
      machineCode: m.code,
      powerW: latest.powerW,
      recordedAt: now,
    });
    results.push({
      code: m.code,
      name: m.name,
      powerW: latest.powerW,
      predictedStatus: result.status,
      confidence: result.confidence,
    });
  }

  const prioritySum = prioritySnapshots.reduce((s, r) => s + r.powerW, 0);
  const vs = calculateVirtualSensorPower({
    mainMeterPowerW: prioritySum + 620,
    mainMeterRecordedAt: now,
    priorityReadings: prioritySnapshots,
  });

  return NextResponse.json({
    ok: true,
    dataSource: "demo",
    scenario,
    recordedAt: now.toISOString(),
    persistedCount: 0,
    virtualSensor: vs,
    machines: results,
  });
}
