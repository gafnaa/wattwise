import { NextResponse } from "next/server";
import { z } from "zod";
import { answerEnergyQuestionWithAi } from "@/lib/ai/advisor";
import { computePeakIdleWindows } from "@/lib/audit/peak-idle";
import { formatTelegramSummaryReport } from "@/lib/audit/recommendations";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";
import {
  calculateWhatIfSavings,
  formatRupiah,
} from "@/lib/mock-dashboard-data";
import { sendTelegramMessage } from "@/lib/telegram/bot";

const telegramUpdateSchema = z.object({
  update_id: z.number().optional(),
  message: z
    .object({
      message_id: z.number().optional(),
      text: z.string().optional(),
      chat: z.object({
        id: z.union([z.number(), z.string()]),
      }),
    })
    .optional(),
});

async function loadPeakIdleForWorkshop(workshopId: string) {
  try {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const sessions = await db.machineStateSession.findMany({
      where: {
        machine: { workshopId },
        status: "IDLE",
        startedAt: { gte: since },
      },
      select: {
        machineId: true,
        status: true,
        startedAt: true,
        durationSec: true,
      },
    });
    return computePeakIdleWindows(sessions);
  } catch {
    return { byMachineId: {}, workshopPeakWindowLabel: null };
  }
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const incomingSecret = request.headers.get(
      "x-telegram-bot-api-secret-token"
    );
    if (incomingSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized webhook" },
        { status: 401 }
      );
    }
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = telegramUpdateSchema.safeParse(rawBody);
  if (!parsed.success || !parsed.data.message?.text) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = String(parsed.data.message.chat.id);
  const fullText = parsed.data.message.text.trim();
  const firstToken = fullText.split(/\s+/)[0].toLowerCase();
  const command = firstToken.startsWith("/")
    ? firstToken.split("@")[0]
    : "free_text";

  const overview = await getDashboardOverview("month");
  let replyText = "";
  let aiSource: "AI_LLM" | "AI_RULE" = "AI_RULE";

  if (command === "/status") {
    const lines = overview.machines.map(
      (m) =>
        `• *${m.name}*: \`${m.status}\` (${m.currentPowerW.toLocaleString("id-ID")} W)`
    );
    replyText = [
      `📡 *Status Mesin Live — ${overview.workshop.name}*`,
      ``,
      ...lines,
      ``,
      `🔌 Virtual CT (Non-Prioritas): *${overview.virtualSensor.currentPowerW} W*`,
      `✅ ESP32 Online: *${overview.workshop.esp32OnlineCount}/${overview.workshop.esp32TotalCount}*`,
    ].join("\n");
  } else if (command === "/help") {
    replyText = [
      `🤖 *Perintah WattWise Bot*`,
      `/start — Ringkasan penghematan energi bulan ini`,
      `/status — Cek status mesin real-time (Working/Idle/Off)`,
      `/laporan — Laporan potensi kerugian idle & saran tindakan`,
      `/tanya <pertanyaan> — Tanya bebas ke WattWise AI Advisor`,
      `/help — Tampilkan daftar perintah`,
      ``,
      `💬 Atau langsung kirim pertanyaan biasa (contoh: _"Mesin mana yang paling boros minggu ini?"_)!`,
    ].join("\n");
  } else if (command === "/start" || command === "/laporan") {
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

    replyText = formatTelegramSummaryReport({
      workshopName: overview.workshop.name,
      totalIdleLossIdr: overview.metrics.idleLossIdr,
      topMachineNames: sorted.slice(0, 2).map((m) => m.name),
      suggestedIdleReductionMinPerDay: 30,
      projectedMonthlySavingIdr: whatIf30.totalSavingIdr,
    });

    if (command === "/laporan") {
      replyText += `\n\n📊 Efisiensi ISO 14955-5: *${overview.metrics.operationalEfficiencyPct}%* (${overview.metrics.efficiencyBadge})\n⚡ Total Energi: *${overview.metrics.totalEnergyKwh} kWh* (${formatRupiah(overview.metrics.totalEnergyCostIdr)})`;
    }
  } else {
    // Pertanyaan bebas atau `/tanya <pertanyaan>` -> Generative AI Advisor berbasis data live
    const question =
      command === "/tanya"
        ? fullText.replace(/^\/tanya(?:@\S+)?\s*/i, "").trim() ||
          "Berikan ringkasan mesin paling boros dan saran penghematan utama bulan ini."
        : fullText;

    const peakAnalysis =
      overview.dataSource === "database"
        ? await loadPeakIdleForWorkshop(overview.workshop.id)
        : { byMachineId: {}, workshopPeakWindowLabel: null };

    const aiReply = await answerEnergyQuestionWithAi({
      question,
      overview,
      peakIdleByMachineId: peakAnalysis.byMachineId,
      workshopPeakWindowLabel: peakAnalysis.workshopPeakWindowLabel,
    });

    replyText = aiReply.answerText;
    aiSource = aiReply.source;
  }

  const sendResult = await sendTelegramMessage({ chatId, text: replyText });

  return NextResponse.json({
    ok: sendResult.ok,
    mode: sendResult.mode,
    command,
    aiSource,
    replyPreview: replyText,
  });
}
