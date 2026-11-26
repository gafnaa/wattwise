import type { MachineStatus } from "../ml/types";

export interface MachineAuditStats {
  machineId: string;
  machineCode: string;
  machineName: string;
  machineType: string;
  idleHoursMonth: number;
  idleKwhMonth: number;
  idleLossIdrMonth: number;
  startupCountMonth: number;
}

export interface GeneratedRecommendation {
  machineId: string;
  machineCode: string;
  machineName: string;
  recommendationText: string;
  estimatedSavingIdrMonth: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface UrgentAlertCheckInput {
  machineStatus: MachineStatus;
  idleDurationMin: number;
  idleAlertThresholdMin: number;
  lastAlertSentAt: Date | null;
  now?: Date;
  cooldownMin?: number;
}

const MACHINE_PLAYBOOK: Record<string, string> = {
  CNC: "Siapkan desain G-code dan jig material sebelum menyalakan spindle agar waktu idle CNC berkurang.",
  EDGE_BANDER:
    "Kelompokkan batch pengeleman tepi secara berurutan agar pemanas dan motor Edge Bander tidak idle berkepanjangan.",
  PANEL_SAW:
    "Matikan motor utama Panel Saw saat jeda pengukuran atau ganti papan kayu lebih dari 10 menit.",
  DUST_COLLECTOR:
    "Sinkronkan jadwal mati Dust Collector saat mesin CNC dan Panel Saw sedang tidak beroperasi.",
  BORING:
    "Jadwalkan proses pengeboran dowel per batch produk untuk mengurangi waktu tunggu antar benda kerja.",
  COMPRESSOR:
    "Periksa kebocoran selang pneumatik dan matikan kompresor saat jam istirahat untuk menekan siklus start-up.",
};

function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Menghasilkan rekomendasi aksi penghematan yang mudah dipahami pemilik UMKM
 * (asumsi target realistis pengurangan 35% waktu idle yang dapat dihindari).
 */
export function generateMachineRecommendations(
  stats: readonly MachineAuditStats[],
  achievableIdleReductionRatio = 0.35
): GeneratedRecommendation[] {
  return [...stats]
    .filter((m) => m.idleLossIdrMonth > 50_000)
    .sort((a, b) => b.idleLossIdrMonth - a.idleLossIdrMonth)
    .map((m) => {
      const estimatedSavingIdrMonth = Math.round(
        m.idleLossIdrMonth * achievableIdleReductionRatio
      );
      const priority: GeneratedRecommendation["priority"] =
        m.idleLossIdrMonth >= 800_000
          ? "HIGH"
          : m.idleLossIdrMonth >= 350_000
            ? "MEDIUM"
            : "LOW";

      const recommendationText =
        MACHINE_PLAYBOOK[m.machineType] ??
        `Kurangi durasi standby tanpa beban pada ${m.machineName} saat jeda antar proses produksi.`;

      return {
        machineId: m.machineId,
        machineCode: m.machineCode,
        machineName: m.machineName,
        recommendationText,
        estimatedSavingIdrMonth,
        priority,
      };
    });
}

/**
 * Menentukan apakah notifikasi urgent idle harus dikirim ke Telegram,
 * dengan perlindungan cooldown (default 30 menit per mesin) agar tidak spam.
 */
export function shouldTriggerUrgentIdleAlert(
  input: UrgentAlertCheckInput
): boolean {
  const {
    machineStatus,
    idleDurationMin,
    idleAlertThresholdMin,
    lastAlertSentAt,
    now = new Date(),
    cooldownMin = 30,
  } = input;

  if (machineStatus !== "IDLE") return false;
  if (idleDurationMin < idleAlertThresholdMin) return false;

  if (lastAlertSentAt) {
    const elapsedMin = (now.getTime() - lastAlertSentAt.getTime()) / 60_000;
    if (elapsedMin < cooldownMin) return false;
  }

  return true;
}

/**
 * Format pesan alert urgent untuk WattWise Telegram Bot.
 */
export function formatTelegramUrgentAlert(params: {
  workshopName: string;
  machineName: string;
  idleDurationMin: number;
  currentPowerW: number;
  estimatedLossThisSessionIdr: number;
  dashboardUrl?: string;
}): string {
  const {
    workshopName,
    machineName,
    idleDurationMin,
    currentPowerW,
    estimatedLossThisSessionIdr,
    dashboardUrl,
  } = params;

  const lines = [
    `⚠️ *Peringatan Daya Idle — ${workshopName}*`,
    ``,
    `Mesin *${machineName}* terdeteksi menyala tanpa beban (*IDLE*) selama *${Math.round(idleDurationMin)} menit*.`,
    `• Daya aktif saat ini: *${Math.round(currentPowerW).toLocaleString("id-ID")} W*`,
    `• Estimasi kerugian sesi ini: *${formatIdr(estimatedLossThisSessionIdr)}*`,
    ``,
    `💡 *Saran:* Segera matikan mesin jika sedang tidak memproses material.`,
  ];

  if (dashboardUrl) {
    lines.push(`🔎 Cek detail di Dashboard: ${dashboardUrl}`);
  }

  return lines.join("\n");
}

/**
 * Format pesan laporan hemat energi berkala sesuai Lampiran 5 Gambar 5.3.
 */
export function formatTelegramSummaryReport(params: {
  workshopName: string;
  totalIdleLossIdr: number;
  topMachineNames: string[];
  suggestedIdleReductionMinPerDay: number;
  projectedMonthlySavingIdr: number;
}): string {
  const {
    workshopName,
    totalIdleLossIdr,
    topMachineNames,
    suggestedIdleReductionMinPerDay,
    projectedMonthlySavingIdr,
  } = params;

  const machinesText =
    topMachineNames.length > 0
      ? topMachineNames.slice(0, 2).join(" & ")
      : "mesin prioritas";

  return [
    `⚡ *Laporan Hemat Energi - ${workshopName}* ⚡`,
    ``,
    `Sistem mendeteksi total potensi kerugian idle bulan ini: *${formatIdr(totalIdleLossIdr)}*.`,
    ``,
    `💡 *Saran Tindakan Utama:*`,
    `Jika waktu idle *${machinesText}* dikurangi *${suggestedIdleReductionMinPerDay} menit/hari*, Anda langsung menghemat:`,
    `💰 *${formatIdr(projectedMonthlySavingIdr)} / bulan*`,
  ].join("\n");
}
