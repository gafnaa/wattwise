import { NextResponse } from "next/server";
import { z } from "zod";
import { formatTelegramSummaryReport } from "@/lib/audit/recommendations";
import { getDashboardOverview } from "@/lib/dashboard/service";
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

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const incomingSecret = request.headers.get(
      "x-telegram-bot-api-secret-token"
    );
    if (incomingSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = telegramUpdateSchema.safeParse(rawBody);
  if (!parsed.success || !parsed.data.message?.text) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = String(parsed.data.message.chat.id);
  const command = parsed.data.message.text.trim().split(/\s+/)[0].toLowerCase();

  const overview = await getDashboardOverview("month");
  let replyText = "";

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
      `/help — Tampilkan daftar perintah`,
    ].join("\n");
  } else {
    // /start atau /laporan (sesuai Lampiran 5 Gambar 5.3)
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
  }

  const sendResult = await sendTelegramMessage({ chatId, text: replyText });

  return NextResponse.json({
    ok: sendResult.ok,
    mode: sendResult.mode,
    command,
    replyPreview: replyText,
  });
}
