import { NextResponse } from "next/server";
import { calculateCostIdr } from "@/lib/audit/calculator";
import {
  generateMachineRecommendations,
  type MachineAuditStats,
} from "@/lib/audit/recommendations";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { INITIAL_MACHINES } from "@/lib/mock-dashboard-data";

/**
 * Mengevaluasi sesi idle 30 hari terakhir per mesin lalu menghasilkan
 * rekomendasi penghematan baru (deduplikasi terhadap status PENDING yang ada).
 */
export async function POST() {
  const session = await getCurrentSession();
  const since = new Date(Date.now() - 30 * 86_400_000);

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return buildDemoGeneratedResponse();
    }

    const tariffIdr = Number(workshop.tariffIdrPerKwh);
    const [machines, sessions, existingPending] = await Promise.all([
      db.machine.findMany({
        where: { workshopId: workshop.id, hasPhysicalSensor: true, isActive: true },
      }),
      db.machineStateSession.findMany({
        where: {
          machine: { workshopId: workshop.id },
          startedAt: { gte: since },
        },
      }),
      db.actionRecommendation.findMany({
        where: { workshopId: workshop.id, status: "PENDING" },
        select: { machineId: true },
      }),
    ]);

    const pendingMachineIds = new Set(existingPending.map((r) => r.machineId));

    const stats: MachineAuditStats[] = machines.map((m) => {
      const mSessions = sessions.filter((s) => s.machineId === m.id);
      const idleSessions = mSessions.filter((s) => s.status === "IDLE");
      const startupCount = mSessions.filter((s) => s.status === "START_UP").length;
      const idleSec = idleSessions.reduce((sum, s) => sum + s.durationSec, 0);
      const idleKwh = idleSessions.reduce((sum, s) => sum + s.energyKwh, 0);

      return {
        machineId: m.id,
        machineCode: m.code,
        machineName: m.name,
        machineType: m.machineType,
        idleHoursMonth: Number((idleSec / 3600).toFixed(2)),
        idleKwhMonth: Number(idleKwh.toFixed(3)),
        idleLossIdrMonth: calculateCostIdr(idleKwh, tariffIdr),
        startupCountMonth: startupCount,
      };
    });

    const generated = generateMachineRecommendations(stats);
    const created: Array<{
      id: string;
      machineCode: string;
      machineName: string;
      recommendationText: string;
      estimatedSavingIdrMonth: number;
      priority: string;
    }> = [];

    for (const rec of generated) {
      if (pendingMachineIds.has(rec.machineId)) continue;
      const row = await db.actionRecommendation.create({
        data: {
          workshopId: workshop.id,
          machineId: rec.machineId,
          recommendationText: rec.recommendationText,
          status: "PENDING",
          source: "AI_RULE",
          estimatedSavingIdr: rec.estimatedSavingIdrMonth,
        },
      });
      created.push({
        id: row.id,
        machineCode: rec.machineCode,
        machineName: rec.machineName,
        recommendationText: rec.recommendationText,
        estimatedSavingIdrMonth: rec.estimatedSavingIdrMonth,
        priority: rec.priority,
      });
    }

    return NextResponse.json({
      ok: true,
      dataSource: "database",
      evaluatedMachines: stats.length,
      newlyCreatedCount: created.length,
      recommendations: created.length > 0 ? created : generated,
    });
  } catch {
    return buildDemoGeneratedResponse();
  }
}

function buildDemoGeneratedResponse() {
  const demoStats: MachineAuditStats[] = INITIAL_MACHINES.map((m) => ({
    machineId: m.id,
    machineCode: m.code,
    machineName: m.name,
    machineType:
      m.code === "CNC-1325"
        ? "CNC"
        : m.code === "EDGE-01"
          ? "EDGE_BANDER"
          : m.code === "PSAW-01"
            ? "PANEL_SAW"
            : m.code === "DUST-01"
              ? "DUST_COLLECTOR"
              : m.code === "BOR-01"
                ? "BORING"
                : "COMPRESSOR",
    idleHoursMonth: m.idleHoursMonth,
    idleKwhMonth: Number((m.idleLossMonthIdr / 1444.7).toFixed(2)),
    idleLossIdrMonth: m.idleLossMonthIdr,
    startupCountMonth: m.startupCountMonth,
  }));

  const generated = generateMachineRecommendations(demoStats);
  return NextResponse.json({
    ok: true,
    dataSource: "demo",
    evaluatedMachines: demoStats.length,
    newlyCreatedCount: 0,
    recommendations: generated,
  });
}
