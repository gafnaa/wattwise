import { NextResponse } from "next/server";
import {
  calculateCostIdr,
  integrateTimeSeriesEnergyKwh,
} from "@/lib/audit/calculator";
import { db } from "@/lib/db";
import { INITIAL_MACHINES, WORKSHOP_INFO } from "@/lib/mock-dashboard-data";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(5, Number(searchParams.get("limit")) || 60));
  const hours = Math.min(168, Math.max(1, Number(searchParams.get("hours")) || 24));
  const since = new Date(Date.now() - hours * 3600_000);

  try {
    const machine = await db.machine.findFirst({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }],
      },
      include: {
        workshop: { select: { tariffIdrPerKwh: true } },
        device: { select: { deviceUid: true, lastSeenAt: true } },
      },
    });

    if (!machine) {
      return buildDemoTelemetryResponse(id);
    }

    const [readingsDesc, sessions] = await Promise.all([
      db.telemetryReading.findMany({
        where: {
          machineId: machine.id,
          recordedAt: { gte: since },
        },
        orderBy: { recordedAt: "desc" },
        take: limit,
      }),
      db.machineStateSession.findMany({
        where: {
          machineId: machine.id,
          startedAt: { gte: since },
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
    ]);

    const readings = readingsDesc.reverse();
    const tariffIdr = Number(machine.workshop.tariffIdrPerKwh);

    const powers = readings.map((r) => r.powerW);
    const avgPowerW =
      powers.length > 0
        ? Number((powers.reduce((s, v) => s + v, 0) / powers.length).toFixed(1))
        : 0;
    const maxPowerW = powers.length > 0 ? Math.max(...powers) : 0;

    const integratedKwh = integrateTimeSeriesEnergyKwh(
      readings.map((r) => ({
        sampleIndex: r.sampleIndex,
        recordedAt: r.recordedAt,
        powerW: r.powerW,
      }))
    );

    const idleSec = sessions
      .filter((s) => s.status === "IDLE")
      .reduce((sum, s) => sum + s.durationSec, 0);
    const workingSec = sessions
      .filter((s) => s.status === "WORKING")
      .reduce((sum, s) => sum + s.durationSec, 0);

    return NextResponse.json({
      dataSource: "database",
      machine: {
        id: machine.id,
        code: machine.code,
        name: machine.name,
        ratedPowerW: machine.ratedPowerW,
        deviceUid: machine.device?.deviceUid ?? null,
      },
      windowHours: hours,
      summary: {
        sampleCount: readings.length,
        avgPowerW,
        maxPowerW,
        integratedKwh,
        estimatedCostIdr: calculateCostIdr(integratedKwh, tariffIdr),
        idleMinutes: Number((idleSec / 60).toFixed(1)),
        workingMinutes: Number((workingSec / 60).toFixed(1)),
      },
      readings: readings.map((r) => ({
        id: r.id.toString(),
        sampleIndex: r.sampleIndex,
        recordedAt: r.recordedAt.toISOString(),
        powerW: r.powerW,
        voltageV: r.voltageV,
        currentA: r.currentA,
        powerFactor: r.powerFactor,
        predictedStatus: r.predictedStatus,
        statusConfidence: r.statusConfidence,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        durationSec: s.durationSec,
        avgPowerW: s.avgPowerW,
        energyKwh: s.energyKwh,
        costIdr: Number(s.costIdr),
      })),
    });
  } catch {
    return buildDemoTelemetryResponse(id);
  }
}

function buildDemoTelemetryResponse(idOrCode: string) {
  const found = INITIAL_MACHINES.find(
    (m) => m.id === idOrCode || m.code.toLowerCase() === idOrCode.toLowerCase()
  );

  if (!found) {
    return NextResponse.json(
      { error: `Mesin '${idOrCode}' tidak ditemukan.` },
      { status: 404 }
    );
  }

  const now = Date.now();
  const readings = found.sparkline.map((pt, idx) => ({
    id: String(idx + 1),
    sampleIndex: idx + 1,
    recordedAt: new Date(
      now - (found.sparkline.length - idx) * 5 * 60_000
    ).toISOString(),
    powerW: pt.powerW,
    voltageV: found.voltageV,
    currentA: found.currentA,
    powerFactor: found.powerFactor,
    predictedStatus: pt.status,
    statusConfidence: 0.96,
  }));

  const avgPowerW = Number(
    (
      readings.reduce((s, r) => s + r.powerW, 0) / Math.max(1, readings.length)
    ).toFixed(1)
  );
  const maxPowerW = Math.max(...readings.map((r) => r.powerW));
  const estKwh = Number(((avgPowerW * 30) / 60_000).toFixed(4));

  return NextResponse.json({
    dataSource: "demo",
    machine: {
      id: found.id,
      code: found.code,
      name: found.name,
      ratedPowerW: found.ratedPowerW,
      deviceUid: found.deviceUid,
    },
    windowHours: 24,
    summary: {
      sampleCount: readings.length,
      avgPowerW,
      maxPowerW,
      integratedKwh: estKwh,
      estimatedCostIdr: calculateCostIdr(estKwh, WORKSHOP_INFO.tariffIdrPerKwh),
      idleMinutes: Number((found.idleHoursMonth * 2).toFixed(1)),
      workingMinutes: Number((found.workingHoursMonth * 2).toFixed(1)),
    },
    readings,
    sessions: [],
  });
}
