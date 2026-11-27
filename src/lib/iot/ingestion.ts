import { calculateEnergyKwhFromPower } from "@/lib/audit/calculator";

/**
 * Interval sampling nominal ESP32 (detik) saat belum ada sampel sebelumnya
 * atau ketika sesi baru dibuka setelah terputus (gap).
 */
export const DEFAULT_SAMPLE_INTERVAL_SEC = 2;

/**
 * Batas maksimum selang waktu antar-sampel (detik) agar masih dianggap
 * satu sesi kontinu. Di atas ambang ini, telemetri dianggap sempat terputus
 * sehingga sesi lama ditutup di pembacaan terakhir dan tidak menghitung
 * energi fiktif selama periode offline.
 */
export const MAX_SESSION_GAP_SEC = 180;

export interface RawTelemetryItem {
  device_uid?: string;
  index?: number;
  sample_index?: number;
  timestamp?: string | number;
  recorded_at?: string | number;
  daya?: number;
  power_w?: number;
  firmware_version?: string;
  is_simulated?: boolean;
  metrics?: {
    voltage_v?: number;
    current_a?: number;
    power_w: number;
    energy_kwh?: number;
    frequency_hz?: number;
    power_factor?: number;
  };
}

export interface NormalizedTelemetryItem {
  recordedAt: Date;
  sampleIndex: number | null;
  powerW: number;
  voltageV: number | null;
  currentA: number | null;
  cumulativeEnergyKwh: number | null;
  frequencyHz: number | null;
  powerFactor: number | null;
  firmwareVersion?: string;
  isSimulated: boolean;
}

export interface BatchNormalizationResult {
  items: NormalizedTelemetryItem[];
  intraBatchDuplicates: number;
}

export interface PreviousReadingSnapshot {
  recordedAt: Date;
  powerW: number;
  cumulativeEnergyKwh: number | null;
}

export type IntervalAccountingKind =
  | "INITIAL"
  | "CONTINUOUS"
  | "GAP_RESET"
  | "DUPLICATE_TIMESTAMP"
  | "OUT_OF_ORDER";

export type EnergyComputationSource =
  | "CUMULATIVE_METER"
  | "TRAPEZOIDAL"
  | "TRAPEZOIDAL_FALLBACK"
  | "POWER_INITIAL"
  | "SKIPPED";

export interface IntervalAccountingResult {
  kind: IntervalAccountingKind;
  shouldSkip: boolean;
  sessionGapDetected: boolean;
  rawDtSec: number;
  accountingDtSec: number;
  intervalAvgPowerW: number;
  deltaKwh: number;
  energySource: EnergyComputationSource;
}

function parseTimestamp(
  input: string | number | undefined,
  fallbackMs: number
): Date {
  if (typeof input === "number" && Number.isFinite(input)) {
    // Mendukung Unix epoch dalam detik (10 digit) maupun milidetik (13 digit)
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(fallbackMs);
}

/**
 * Menormalisasi, mengurutkan secara kronologis, dan men-deduplikasi batch
 * telemetri (mis. hasil flush offline ring-buffer ESP32) sebelum masuk DB.
 */
export function normalizeAndDedupeTelemetryBatch(
  rawItems: readonly RawTelemetryItem[],
  fallbackNowMs = Date.now()
): BatchNormalizationResult {
  const normalized: NormalizedTelemetryItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const powerW = item.metrics?.power_w ?? item.power_w ?? item.daya;
    if (typeof powerW !== "number" || !Number.isFinite(powerW)) {
      continue;
    }

    const tsInput = item.recorded_at ?? item.timestamp;
    // Offset +i ms memastikan item tanpa timestamp dalam 1 batch tidak saling menimpa
    const recordedAt = parseTimestamp(tsInput, fallbackNowMs + i);
    const rawCum = item.metrics?.energy_kwh;
    const cumulativeEnergyKwh =
      typeof rawCum === "number" && Number.isFinite(rawCum) && rawCum >= 0
        ? rawCum
        : null;

    normalized.push({
      recordedAt,
      sampleIndex: item.sample_index ?? item.index ?? null,
      powerW: Math.max(0, powerW),
      voltageV: item.metrics?.voltage_v ?? null,
      currentA: item.metrics?.current_a ?? null,
      cumulativeEnergyKwh,
      frequencyHz: item.metrics?.frequency_hz ?? null,
      powerFactor: item.metrics?.power_factor ?? null,
      firmwareVersion: item.firmware_version,
      isSimulated: Boolean(item.is_simulated),
    });
  }

  // Urutkan kronologis naik agar batch ring-buffer selalu terintegrasi berurutan
  normalized.sort((a, b) => {
    const dt = a.recordedAt.getTime() - b.recordedAt.getTime();
    if (dt !== 0) return dt;
    return (a.sampleIndex ?? 0) - (b.sampleIndex ?? 0);
  });

  const deduped: NormalizedTelemetryItem[] = [];
  const seenTimestamps = new Set<number>();
  let intraBatchDuplicates = 0;

  for (const item of normalized) {
    const tsMs = item.recordedAt.getTime();
    if (seenTimestamps.has(tsMs)) {
      intraBatchDuplicates++;
      continue;
    }
    seenTimestamps.add(tsMs);
    deduped.push(item);
  }

  return { items: deduped, intraBatchDuplicates };
}

/**
 * Menghitung durasi aktual dan energi delta (kWh) per interval secara terpisah
 * dari clamp preprocessing ML (`features.ts`), dengan:
 * 1. Deduplikasi timestamp identik & proteksi paket out-of-order.
 * 2. Deteksi gap koneksi (> `maxGapSec`) agar tidak menghitung energi fiktif.
 * 3. Pemisahan tegas antara `cumulativeEnergyKwh` (meter kumulatif PZEM-004T)
 *    vs `deltaKwh` (energi interval), dengan fallback integrasi trapesium.
 */
export function computeIntervalAccounting(params: {
  prevReading: PreviousReadingSnapshot | null;
  currRecordedAt: Date;
  currPowerW: number;
  currCumulativeEnergyKwh: number | null;
  ratedPowerW: number;
  maxGapSec?: number;
  defaultIntervalSec?: number;
}): IntervalAccountingResult {
  const {
    prevReading,
    currRecordedAt,
    currPowerW,
    currCumulativeEnergyKwh,
    ratedPowerW,
    maxGapSec = MAX_SESSION_GAP_SEC,
    defaultIntervalSec = DEFAULT_SAMPLE_INTERVAL_SEC,
  } = params;

  const safeCurrPowerW = Math.max(0, currPowerW);

  if (!prevReading) {
    return {
      kind: "INITIAL",
      shouldSkip: false,
      sessionGapDetected: false,
      rawDtSec: defaultIntervalSec,
      accountingDtSec: defaultIntervalSec,
      intervalAvgPowerW: safeCurrPowerW,
      deltaKwh: calculateEnergyKwhFromPower(safeCurrPowerW, defaultIntervalSec),
      energySource: "POWER_INITIAL",
    };
  }

  const rawDtSec =
    (currRecordedAt.getTime() - prevReading.recordedAt.getTime()) / 1000;

  if (rawDtSec === 0) {
    return {
      kind: "DUPLICATE_TIMESTAMP",
      shouldSkip: true,
      sessionGapDetected: false,
      rawDtSec: 0,
      accountingDtSec: 0,
      intervalAvgPowerW: 0,
      deltaKwh: 0,
      energySource: "SKIPPED",
    };
  }

  if (rawDtSec < 0) {
    return {
      kind: "OUT_OF_ORDER",
      shouldSkip: true,
      sessionGapDetected: false,
      rawDtSec,
      accountingDtSec: 0,
      intervalAvgPowerW: 0,
      deltaKwh: 0,
      energySource: "SKIPPED",
    };
  }

  if (rawDtSec > maxGapSec) {
    return {
      kind: "GAP_RESET",
      shouldSkip: false,
      sessionGapDetected: true,
      rawDtSec,
      accountingDtSec: defaultIntervalSec,
      intervalAvgPowerW: safeCurrPowerW,
      deltaKwh: calculateEnergyKwhFromPower(safeCurrPowerW, defaultIntervalSec),
      energySource: "POWER_INITIAL",
    };
  }

  const prevPowerW = Math.max(0, prevReading.powerW);
  const trapezoidalAvgW = (prevPowerW + safeCurrPowerW) / 2;
  const trapezoidalKwh = calculateEnergyKwhFromPower(trapezoidalAvgW, rawDtSec);

  // Gunakan selisih meter kumulatif PZEM-004T jika kedua titik tersedia,
  // monoton naik, dan masih dalam batas fisik daya mesin.
  if (
    prevReading.cumulativeEnergyKwh !== null &&
    currCumulativeEnergyKwh !== null
  ) {
    const meterDiff = currCumulativeEnergyKwh - prevReading.cumulativeEnergyKwh;
    const peakEnvelopeW = Math.max(ratedPowerW, prevPowerW, safeCurrPowerW, 500) * 1.6;
    const maxPlausibleKwh =
      (peakEnvelopeW * rawDtSec) / 3_600_000 + 0.002;

    if (meterDiff >= 0 && meterDiff <= maxPlausibleKwh) {
      return {
        kind: "CONTINUOUS",
        shouldSkip: false,
        sessionGapDetected: false,
        rawDtSec,
        accountingDtSec: rawDtSec,
        intervalAvgPowerW: Number(trapezoidalAvgW.toFixed(1)),
        deltaKwh: Number(meterDiff.toFixed(6)),
        energySource: "CUMULATIVE_METER",
      };
    }

    // Meter PZEM baru di-reset (negatif) atau lonjakan korup -> fallback trapesium
    return {
      kind: "CONTINUOUS",
      shouldSkip: false,
      sessionGapDetected: false,
      rawDtSec,
      accountingDtSec: rawDtSec,
      intervalAvgPowerW: Number(trapezoidalAvgW.toFixed(1)),
      deltaKwh: trapezoidalKwh,
      energySource: "TRAPEZOIDAL_FALLBACK",
    };
  }

  return {
    kind: "CONTINUOUS",
    shouldSkip: false,
    sessionGapDetected: false,
    rawDtSec,
    accountingDtSec: rawDtSec,
    intervalAvgPowerW: Number(trapezoidalAvgW.toFixed(1)),
    deltaKwh: trapezoidalKwh,
    energySource: "TRAPEZOIDAL",
  };
}

/**
 * Memeriksa apakah error Prisma adalah unique constraint violation (P2002),
 * berguna untuk deduplikasi race-safe saat dua request retry tiba bersamaan.
 */
export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}
