import { NextResponse } from "next/server";
import { z } from "zod";
import { formatTelegramSummaryReport } from "@/lib/audit/recommendations";
import { requireApiAuth } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram/bot";

const sendReportSchema = z.object({
  idleReductionMinPerDay: z.number().min(0).max(240),
  startupReductionPct: z.number().min(0).max(100),
  projectedMonthlySavingIdr: z.number().nonnegative(),
  currentIdleLossIdr: z.number().nonnegative(),
  chatId: z.string().optional(),
});

export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth();
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const parsed = sendReportSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload laporan Telegram tidak valid." },
      { status: 400 }
    );
  }

  const overview = await getDashboardOverview("month", session?.workshopId);

  const sorted = [...overview.machines].sort(
    (a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr
  );

  const messageBody =
    formatTelegramSummaryReport({
      workshopName: overview.workshop.name,
      totalIdleLossIdr: parsed.data.currentIdleLossIdr,
      topMachineNames: sorted.slice(0, 2).map((m) => m.name),
      suggestedIdleReductionMinPerDay: parsed.data.idleReductionMinPerDay,
      projectedMonthlySavingIdr: parsed.data.projectedMonthlySavingIdr,
    }) +
    `\n(Target tekan start-up berlebih: *${parsed.data.startupReductionPct}%*)`;

  let targetChatId = parsed.data.chatId;
  if (!targetChatId && overview.dataSource === "database") {
    try {
      const ws = await db.workshop.findUnique({
        where: { id: overview.workshop.id },
        select: { telegramChatId: true },
      });
      targetChatId = ws?.telegramChatId ?? undefined;
    } catch {
      // Abaikan jika DB tidak tersedia
    }
  }

  const sendResult = await sendTelegramMessage({
    chatId: targetChatId,
    text: messageBody,
  });

  // Catat log pengiriman ke database jika PostgreSQL aktif
  if (overview.dataSource === "database") {
    try {
      await db.telegramNotification.create({
        data: {
          workshopId: overview.workshop.id,
          notificationType: "WHAT_IF_REPORT",
          messageBody,
          deliveryStatus: sendResult.ok ? "SENT" : "FAILED",
        },
      });
    } catch {
      // Tetap kembalikan hasil pengiriman ke client
    }
  }

  return NextResponse.json({
    ok: sendResult.ok,
    mode: sendResult.mode,
    error: sendResult.error,
    messagePreview: messageBody,
  });
}
