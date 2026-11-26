import type { MachineStatus, PowerSample } from "../ml/types";

export type EfficiencyCategory =
  | "Sangat Baik"
  | "Baik"
  | "Perlu Perbaikan"
  | "Boros";

export interface IsoEnergyBreakdown {
  workingKwh: number;
  idleKwh: number;
  startupKwh: number;
  offKwh?: number;
}

export interface IsoEfficiencyResult {
  efficiencyPct: number;
  category: EfficiencyCategory;
  activeEnergyKwh: number;
  idleSharePct: number;
  startupSharePct: number;
}

export interface MachineSessionSummary {
  machineId: string;
  machineCode: string;
  machineName: string;
  status: MachineStatus;
  durationSec: number;
  energyKwh: number;
}

export interface ParetoMachineItem {
  machineId: string;
  machineCode: string;
  machineName: string;
  idleKwh: number;
  idleHours: number;
  idleLossIdr: number;
  shareOfTotalIdlePct: number;
}

export interface WhatIfProjectionInput {
  idleReductionMinPerDay: number;
  startupReductionPct: number;
  avgTotalIdlePowerKw: number;
  monthlyStartupCount: number;
  avgStartupEnergyKwh?: number;
  workingDaysPerMonth?: number;
  tariffIdrPerKwh: number;
}

export interface WhatIfProjectionResult {
  idleSavedKwhMonth: number;
  startupSavedKwhMonth: number;
  totalSavedKwhMonth: number;
  idleSavingIdrMonth: number;
  startupSavingIdrMonth: number;
  totalSavingIdrMonth: number;
}

/**
 * Menghitung energi (kWh) dari daya rata-rata (Watt) dan durasi (detik).
 */
export function calculateEnergyKwhFromPower(
  avgPowerW: number,
  durationSec: number
): number {
  if (avgPowerW <= 0 || durationSec <= 0) return 0;
  return Number(((avgPowerW * durationSec) / 3_600_000).toFixed(6));
}

/**
 * Integrasi numerik energi (kWh) langsung dari deret waktu `(timestamp, powerW)`.
 * Sangat penting ketika sensor hanya mengirim 3 kolom (`index, timestamp, daya`)
 * tanpa accumulator kWh bawaan PZEM.
 */
export function integrateTimeSeriesEnergyKwh(
  samples: readonly PowerSample[],
  maxGapSec = 30
): number {
  if (samples.length < 2) return 0;

  let totalKwh = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const t0 =
      typeof prev.recordedAt === "number"
        ? prev.recordedAt
        : new Date(prev.recordedAt).getTime();
    const t1 =
      typeof curr.recordedAt === "number"
        ? curr.recordedAt
        : new Date(curr.recordedAt).getTime();

    const dtSec = (t1 - t0) / 1000;
    if (dtSec <= 0 || dtSec > maxGapSec) continue;

    // Aturan trapesium: rata-rata daya antara t0 dan t1
    const avgW = (Math.max(0, prev.powerW) + Math.max(0, curr.powerW)) / 2;
    totalKwh += (avgW * dtSec) / 3_600_000;
  }

  return Number(totalKwh.toFixed(6));
}

/**
 * Mengonversi energi (kWh) menjadi estimasi biaya listrik (Rupiah).
 */
export function calculateCostIdr(
  energyKwh: number,
  tariffIdrPerKwh: number
): number {
  if (energyKwh <= 0 || tariffIdrPerKwh <= 0) return 0;
  return Number((energyKwh * tariffIdrPerKwh).toFixed(2));
}

/**
 * Efisiensi Daya Operasional berbasis standar ISO 14955-5:
 *   η = E_working / (E_working + E_idle + E_startup) × 100%
 */
export function calculateIsoOperationalEfficiency(
  breakdown: IsoEnergyBreakdown
): IsoEfficiencyResult {
  const working = Math.max(0, breakdown.workingKwh);
  const idle = Math.max(0, breakdown.idleKwh);
  const startup = Math.max(0, breakdown.startupKwh);
  const activeEnergyKwh = working + idle + startup;

  if (activeEnergyKwh <= 0) {
    return {
      efficiencyPct: 0,
      category: "Boros",
      activeEnergyKwh: 0,
      idleSharePct: 0,
      startupSharePct: 0,
    };
  }

  const efficiencyPct = Number(((working / activeEnergyKwh) * 100).toFixed(1));
  const idleSharePct = Number(((idle / activeEnergyKwh) * 100).toFixed(1));
  const startupSharePct = Number(((startup / activeEnergyKwh) * 100).toFixed(1));

  let category: EfficiencyCategory = "Boros";
  if (efficiencyPct >= 75) category = "Sangat Baik";
  else if (efficiencyPct >= 60) category = "Baik";
  else if (efficiencyPct >= 45) category = "Perlu Perbaikan";

  return {
    efficiencyPct,
    category,
    activeEnergyKwh: Number(activeEnergyKwh.toFixed(4)),
    idleSharePct,
    startupSharePct,
  };
}

/**
 * Konsumsi Energi Spesifik (SEC = Total kWh / Unit Produk Sejenis)
 * untuk evaluasi baseline vs pasca-intervensi sesuai proposal.
 */
export function calculateSpecificEnergyConsumption(
  totalEnergyKwh: number,
  outputUnits: number
): number | null {
  if (outputUnits <= 0 || totalEnergyKwh < 0) return null;
  return Number((totalEnergyKwh / outputUnits).toFixed(4));
}

/**
 * Simulator Hemat "What-If" bulanan sesuai rumus ARCHITECTURE.md:
 *   Hemat_idle    = (Δt_idle_hari / 60) × P_idle_kW × H_kerja × Tarif
 *   Hemat_startup = ΔN_startup_bln × E_startup_kWh × Tarif
 */
export function calculateWhatIfProjection(
  input: WhatIfProjectionInput
): WhatIfProjectionResult {
  const {
    idleReductionMinPerDay,
    startupReductionPct,
    avgTotalIdlePowerKw,
    monthlyStartupCount,
    avgStartupEnergyKwh = 0.045,
    workingDaysPerMonth = 26,
    tariffIdrPerKwh,
  } = input;

  const safeIdleMin = Math.max(0, idleReductionMinPerDay);
  const safeStartupPct = Math.max(0, Math.min(100, startupReductionPct));

  const idleSavedKwhMonth =
    (safeIdleMin / 60) * Math.max(0, avgTotalIdlePowerKw) * workingDaysPerMonth;
  const reducedStartups = monthlyStartupCount * (safeStartupPct / 100);
  const startupSavedKwhMonth = reducedStartups * avgStartupEnergyKwh;
  const totalSavedKwhMonth = idleSavedKwhMonth + startupSavedKwhMonth;

  const idleSavingIdrMonth = Math.round(idleSavedKwhMonth * tariffIdrPerKwh);
  const startupSavingIdrMonth = Math.round(
    startupSavedKwhMonth * tariffIdrPerKwh
  );

  return {
    idleSavedKwhMonth: Number(idleSavedKwhMonth.toFixed(2)),
    startupSavedKwhMonth: Number(startupSavedKwhMonth.toFixed(2)),
    totalSavedKwhMonth: Number(totalSavedKwhMonth.toFixed(2)),
    idleSavingIdrMonth,
    startupSavingIdrMonth,
    totalSavingIdrMonth: idleSavingIdrMonth + startupSavingIdrMonth,
  };
}

/**
 * Menyusun peringkat Pareto kerugian idle per mesin (urut dari rugi terbesar).
 */
export function buildParetoIdleLoss(
  sessions: readonly MachineSessionSummary[],
  tariffIdrPerKwh: number
): ParetoMachineItem[] {
  const byMachine = new Map<
    string,
    {
      machineId: string;
      machineCode: string;
      machineName: string;
      idleKwh: number;
      idleSec: number;
    }
  >();

  for (const s of sessions) {
    if (s.status !== "IDLE") continue;
    const prev = byMachine.get(s.machineId) ?? {
      machineId: s.machineId,
      machineCode: s.machineCode,
      machineName: s.machineName,
      idleKwh: 0,
      idleSec: 0,
    };
    prev.idleKwh += Math.max(0, s.energyKwh);
    prev.idleSec += Math.max(0, s.durationSec);
    byMachine.set(s.machineId, prev);
  }

  const list = Array.from(byMachine.values());
  const totalIdleKwh = list.reduce((sum, item) => sum + item.idleKwh, 0);

  return list
    .map((item) => {
      const idleLossIdr = Math.round(item.idleKwh * tariffIdrPerKwh);
      const shareOfTotalIdlePct =
        totalIdleKwh > 0
          ? Number(((item.idleKwh / totalIdleKwh) * 100).toFixed(1))
          : 0;
      return {
        machineId: item.machineId,
        machineCode: item.machineCode,
        machineName: item.machineName,
        idleKwh: Number(item.idleKwh.toFixed(3)),
        idleHours: Number((item.idleSec / 3600).toFixed(2)),
        idleLossIdr,
        shareOfTotalIdlePct,
      };
    })
    .sort((a, b) => b.idleLossIdr - a.idleLossIdr);
}
