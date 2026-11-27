import { NextResponse } from "next/server";
import { z } from "zod";
import { formatTelegramSummaryReport } from "@/lib/audit/recommendations";
import { getCurrentSession, requireApiAuth } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";
import {
  calculateWhatIfSavings,
  type DateRangeKey,
} from "@/lib/mock-dashboard-data";
import { sendTelegramMessage } from "@/lib/telegram/bot";

export interface SerializedAuditReport {
  id: string;
  title: string;
  periodRange: DateRangeKey;
  machineScope: string;
  format: "PDF" | "CSV" | "TELEGRAM";
  source: "MANUAL" | "AUTOMATIC";
  status: "READY" | "SENT" | "FAILED";
  totalEnergyKwh: number;
  totalCostIdr: number;
  idleLossIdr: number;
  efficiencyPct: number;
  machineCount: number;
  createdBy: string | null;
  createdAt: string;
}

const createReportSchema = z.object({
  range: z.enum(["today", "week", "month"]).default("month"),
  scope: z.string().trim().min(1).max(64).default("ALL"),
  format: z.enum(["pdf", "csv", "telegram"]).default("pdf"),
  title: z.string().trim().min(3).max(160).optional(),
});

function serializeReport(row: {
  id: string;
  title: string;
  periodRange: string;
  machineScope: string;
  format: "PDF" | "CSV" | "TELEGRAM";
  source: "MANUAL" | "AUTOMATIC";
  status: "READY" | "SENT" | "FAILED";
  totalEnergyKwh: number;
  totalCostIdr: unknown;
  idleLossIdr: unknown;
  efficiencyPct: number;
  machineCount: number;
  createdBy: string | null;
  createdAt: Date;
}): SerializedAuditReport {
  const safeRange: DateRangeKey =
    row.periodRange === "today" ||
    row.periodRange === "week" ||
    row.periodRange === "month"
      ? row.periodRange
      : "month";

  return {
    id: row.id,
    title: row.title,
    periodRange: safeRange,
    machineScope: row.machineScope,
    format: row.format,
    source: row.source,
    status: row.status,
    totalEnergyKwh: Number(row.totalEnergyKwh.toFixed(1)),
    totalCostIdr: Math.round(Number(row.totalCostIdr)),
    idleLossIdr: Math.round(Number(row.idleLossIdr)),
    efficiencyPct: Number(row.efficiencyPct.toFixed(1)),
    machineCount: row.machineCount,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 25));
  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({ dataSource: "demo", reports: [] });
    }

    const rows = await db.auditReport.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      dataSource: "database",
      reports: rows.map(serializeReport),
    });
  } catch {
    return NextResponse.json({ dataSource: "demo", reports: [] });
  }
}

export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth();
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const parsed = createReportSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Parameter laporan tidak valid.",
      },
      { status: 400 }
    );
  }

  const { range, format } = parsed.data;
  const scope = parsed.data.scope.toUpperCase();
  const overview = await getDashboardOverview(range, session?.workshopId);

  const filteredMachines =
    scope === "ALL"
      ? overview.machines
      : overview.machines.filter((m) => m.code.toUpperCase() === scope);
  const targetMachines =
    filteredMachines.length > 0 ? filteredMachines : overview.machines;
  const isSingleMachine = scope !== "ALL" && filteredMachines.length === 1;

  const periodLabel =
    range === "today"
      ? "Hari Ini"
      : range === "week"
        ? "Mingguan (7 Hari)"
        : "Bulanan (30 Hari)";
  const scopeTitle = isSingleMachine
    ? targetMachines[0].name
    : `Seluruh Mesin (${targetMachines.length})`;

  const defaultTitle =
    format === "telegram"
      ? `Ringkasan Telegram ${periodLabel} — ${scopeTitle}`
      : `Laporan Audit ${periodLabel} — ${scopeTitle}`;
  const title = parsed.data.title ?? defaultTitle;

  const paretoScale = overview.metrics.paretoScale;
  const tariffIdr = overview.workshop.tariffIdrPerKwh;
  const totalEnergyKwh = isSingleMachine
    ? Number(
        (
          ((targetMachines[0].workingHoursMonth *
            targetMachines[0].baselineWorkingW +
            targetMachines[0].idleHoursMonth * targetMachines[0].baselineIdleW) /
            1000) *
          paretoScale
        ).toFixed(1)
      )
    : overview.metrics.totalEnergyKwh;
  const totalCostIdr = isSingleMachine
    ? Math.round(totalEnergyKwh * tariffIdr)
    : overview.metrics.totalEnergyCostIdr;
  const idleLossIdr = isSingleMachine
    ? Math.round(targetMachines[0].idleLossMonthIdr * paretoScale)
    : overview.metrics.idleLossIdr;

  const dbFormat =
    format === "pdf" ? "PDF" : format === "csv" ? "CSV" : "TELEGRAM";
  let reportStatus: "READY" | "SENT" | "FAILED" = "READY";
  let telegramMode: "live" | "simulated" | undefined;

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (format === "telegram") {
      const sorted = [...targetMachines].sort(
        (a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr
      );
      const whatIf30 = calculateWhatIfSavings({
        idleReductionMinPerDay: 30,
        startupReductionPct: 35,
        machines: targetMachines,
        tariffIdrPerKwh: tariffIdr,
        workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
      });

      const messageText = formatTelegramSummaryReport({
        workshopName: overview.workshop.name,
        totalIdleLossIdr: idleLossIdr,
        topMachineNames: sorted.slice(0, 2).map((m) => m.name),
        suggestedIdleReductionMinPerDay: 30,
        projectedMonthlySavingIdr: whatIf30.totalSavingIdr,
      });

      const tgRes = await sendTelegramMessage({
        chatId: workshop?.telegramChatId,
        text: messageText,
      });
      telegramMode = tgRes.mode;
      reportStatus = tgRes.ok ? "SENT" : "FAILED";

      if (workshop) {
        await db.telegramNotification.create({
          data: {
            workshopId: workshop.id,
            notificationType: "DAILY_SUMMARY",
            messageBody: messageText,
            deliveryStatus: tgRes.ok ? "SENT" : "FAILED",
          },
        });
      }
    }

    if (!workshop) {
      const fallback: SerializedAuditReport = {
        id: `demo-rep-${Date.now()}`,
        title,
        periodRange: range,
        machineScope: scope,
        format: dbFormat,
        source: "MANUAL",
        status: reportStatus,
        totalEnergyKwh,
        totalCostIdr,
        idleLossIdr,
        efficiencyPct: overview.metrics.operationalEfficiencyPct,
        machineCount: targetMachines.length,
        createdBy: session?.fullName ?? "Pemilik Pabrik",
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json(
        {
          ok: true,
          persisted: false,
          telegramMode,
          report: fallback,
          downloadUrl:
            format === "telegram"
              ? null
              : `/api/export/audit?range=${range}&format=${format}&scope=${encodeURIComponent(scope)}`,
        },
        { status: 201 }
      );
    }

    const created = await db.auditReport.create({
      data: {
        workshopId: workshop.id,
        title,
        periodRange: range,
        machineScope: scope,
        format: dbFormat,
        source: "MANUAL",
        status: reportStatus,
        totalEnergyKwh,
        totalCostIdr,
        idleLossIdr,
        efficiencyPct: overview.metrics.operationalEfficiencyPct,
        machineCount: targetMachines.length,
        createdBy: session?.fullName ?? "Pemilik Pabrik",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        persisted: true,
        telegramMode,
        report: serializeReport(created),
        downloadUrl:
          format === "telegram"
            ? null
            : `/api/export/audit?range=${range}&format=${format}&scope=${encodeURIComponent(scope)}`,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Gagal menyimpan laporan audit energi.",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { session, response: authError } = await requireApiAuth({
    roles: ["OWNER", "ADMIN"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "Parameter query id wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({ ok: true, deletedId: id, persisted: false });
    }

    const deleted = await db.auditReport.deleteMany({
      where: {
        id,
        workshopId: workshop.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deletedId: id, persisted: true });
  } catch {
    return NextResponse.json(
      { error: "Gagal menghapus riwayat laporan." },
      { status: 500 }
    );
  }
}
