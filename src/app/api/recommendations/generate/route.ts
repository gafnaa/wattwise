import { NextResponse } from "next/server";
import { generateGroundedAiRecommendations } from "@/lib/ai/advisor";
import { calculateCostIdr } from "@/lib/audit/calculator";
import { computePeakIdleWindows } from "@/lib/audit/peak-idle";
import {
  generateMachineRecommendations,
  type MachineAuditStats,
} from "@/lib/audit/recommendations";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { INITIAL_MACHINES } from "@/lib/mock-dashboard-data";

/**
 * Pipeline 3-Tahap WattWise:
 * 1) Random Forest (telah menyimpan sesi status mesin ke DB)
 * 2) Rule-Based Calculator + Peak Idle Window (hitung kWh, Rp, jam rawan idle)
 * 3) Generative AI Advisor (saran operasional kontekstual + fallback otomatis ke rule-based)
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rawBody = (await request.json().catch(() => ({}))) as {
    replacePending?: boolean;
  };
  const replacePending = Boolean(rawBody?.replacePending);

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return await buildDemoGeneratedResponse();
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
        select: { id: true, machineId: true },
      }),
    ]);

    const peakAnalysis = computePeakIdleWindows(sessions);

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

    const ruleBased = generateMachineRecommendations(stats);
    const aiResult = await generateGroundedAiRecommendations({
      workshopName: workshop.name,
      tariffIdrPerKwh: tariffIdr,
      workingDaysPerMonth: workshop.workingDaysPerMonth,
      stats,
      peakIdleByMachineId: peakAnalysis.byMachineId,
      ruleBasedFallback: ruleBased,
    });

    if (replacePending && existingPending.length > 0) {
      await db.actionRecommendation.deleteMany({
        where: {
          workshopId: workshop.id,
          status: "PENDING",
          source: { in: ["AI_RULE", "AI_LLM"] },
        },
      });
    }

    const pendingMachineIds = replacePending
      ? new Set<string>()
      : new Set(existingPending.map((r) => r.machineId));

    const created: Array<{
      id: string;
      machineCode: string;
      machineName: string;
      recommendationText: string;
      estimatedSavingIdrMonth: number;
      priority: string;
      source: string;
      peakIdleWindow: string | null;
    }> = [];

    for (const rec of aiResult.recommendations) {
      if (pendingMachineIds.has(rec.machineId)) continue;
      const row = await db.actionRecommendation.create({
        data: {
          workshopId: workshop.id,
          machineId: rec.machineId,
          recommendationText: rec.recommendationText,
          status: "PENDING",
          source: aiResult.source,
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
        source: aiResult.source,
        peakIdleWindow:
          peakAnalysis.byMachineId[rec.machineId]?.peakWindowLabel ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      dataSource: "database",
      aiSource: aiResult.source,
      aiProvider: aiResult.provider,
      aiModel: aiResult.model,
      workshopPeakIdleWindow: peakAnalysis.workshopPeakWindowLabel,
      evaluatedMachines: stats.length,
      newlyCreatedCount: created.length,
      recommendations:
        created.length > 0
          ? created
          : aiResult.recommendations.map((rec) => ({
              ...rec,
              source: aiResult.source,
              peakIdleWindow:
                peakAnalysis.byMachineId[rec.machineId]?.peakWindowLabel ?? null,
            })),
    });
  } catch {
    return await buildDemoGeneratedResponse();
  }
}

async function buildDemoGeneratedResponse() {
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

  const ruleBased = generateMachineRecommendations(demoStats);
  const aiResult = await generateGroundedAiRecommendations({
    workshopName: "Area Produksi Furnitur — Sukoharjo",
    tariffIdrPerKwh: 1444.7,
    workingDaysPerMonth: 26,
    stats: demoStats,
    peakIdleByMachineId: {},
    ruleBasedFallback: ruleBased,
  });

  return NextResponse.json({
    ok: true,
    dataSource: "demo",
    aiSource: aiResult.source,
    aiProvider: aiResult.provider,
    aiModel: aiResult.model,
    evaluatedMachines: demoStats.length,
    newlyCreatedCount: 0,
    recommendations: aiResult.recommendations,
  });
}
