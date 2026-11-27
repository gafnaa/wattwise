import { NextResponse } from "next/server";
import { computePeakIdleWindows } from "@/lib/audit/peak-idle";
import { formatTelegramSummaryReport } from "@/lib/audit/recommendations";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";
import {
  calculateWhatIfSavings,
  formatRupiah,
} from "@/lib/mock-dashboard-data";
import { sendTelegramMessage } from "@/lib/telegram/bot";

/**
 * Otomatisasi harian WattWise:
 * 1) Kirim laporan ringkasan energi & jam rawan idle ke Telegram Bot
 * 2) Jalankan pembersihan retensi 30 hari pada `telemetry_readings` mentah
 *
 * Lindungi via header `X-Cron-Secret` / `Authorization: Bearer <CRON_SECRET>`
 * atau sesi Owner/Admin.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const session = await getCurrentSession();
  const authorizedByCron = Boolean(cronSecret && headerSecret === cronSecret);
  const authorizedBySession =
    session?.role === "OWNER" || session?.role === "ADMIN";

  if (!authorizedByCron && !authorizedBySession) {
    return NextResponse.json(
      { error: "Unauthorized. Membutuhkan X-Cron-Secret atau sesi Owner." },
      { status: 401 }
    );
  }

  const rawBody = (await request.json().catch(() => ({}))) as {
    retentionDays?: number;
    skipRetention?: boolean;
  };
  const retentionDays = Math.min(
    365,
    Math.max(7, Number(rawBody?.retentionDays) || 30)
  );
  const skipRetention = Boolean(rawBody?.skipRetention);

  const overview = await getDashboardOverview("month", session?.workshopId);
  const sorted = [...overview.machines].sort(
    (a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr
  );
  const whatIf30 = calculateWhatIfSavings({
    idleReductionMinPerDay: 30,
    startupReductionPct: 35,
    machines: overview.machines,
    tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
  });

  let peakWindowLabel: string | null = null;
  let targetChatId: string | null = null;
  let deletedTelemetryRows = 0;

  if (overview.dataSource === "database") {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [ws, idleSessions] = await Promise.all([
      db.workshop.findUnique({
        where: { id: overview.workshop.id },
        select: { telegramChatId: true },
      }),
      db.machineStateSession.findMany({
        where: {
          machine: { workshopId: overview.workshop.id },
          status: "IDLE",
          startedAt: { gte: since30 },
        },
        select: {
          machineId: true,
          status: true,
          startedAt: true,
          durationSec: true,
        },
      }),
    ]);

    targetChatId = ws?.telegramChatId ?? null;
    peakWindowLabel =
      computePeakIdleWindows(idleSessions).workshopPeakWindowLabel;

    if (!skipRetention) {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
      const deleted = await db.telemetryReading.deleteMany({
        where: { recordedAt: { lt: cutoff } },
      });
      deletedTelemetryRows = deleted.count;
    }
  }

  const messageLines = [
    formatTelegramSummaryReport({
      workshopName: overview.workshop.name,
      totalIdleLossIdr: overview.metrics.idleLossIdr,
      topMachineNames: sorted.slice(0, 2).map((m) => m.name),
      suggestedIdleReductionMinPerDay: 30,
      projectedMonthlySavingIdr: whatIf30.totalSavingIdr,
    }),
    ``,
    `📊 Efisiensi ISO 14955-5: *${overview.metrics.operationalEfficiencyPct}%* (${overview.metrics.efficiencyBadge})`,
    `⚡ Total energi 30 hari: *${overview.metrics.totalEnergyKwh} kWh* (${formatRupiah(overview.metrics.totalEnergyCostIdr)})`,
  ];

  if (peakWindowLabel) {
    messageLines.push(`⏰ Jam rawan idle tertinggi: *${peakWindowLabel}*`);
  }

  const messageBody = messageLines.join("\n");
  const tgResult = await sendTelegramMessage({
    chatId: targetChatId,
    text: messageBody,
  });

  if (overview.dataSource === "database") {
    await db.telegramNotification
      .create({
        data: {
          workshopId: overview.workshop.id,
          notificationType: "DAILY_SUMMARY",
          messageBody,
          deliveryStatus: tgResult.ok ? "SENT" : "FAILED",
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({
    ok: tgResult.ok,
    dataSource: overview.dataSource,
    telegramMode: tgResult.mode,
    peakIdleWindow: peakWindowLabel,
    retention: {
      skipped: skipRetention,
      retentionDays,
      deletedTelemetryRows,
    },
    messagePreview: messageBody,
  });
}
