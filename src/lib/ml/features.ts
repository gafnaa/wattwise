import {
  FEATURE_NAMES,
  type ExtractedFeatures,
  type FeatureName,
  type PowerSample,
} from "./types";

function toTimestampMs(input: Date | string | number): number {
  if (typeof input === "number") return input;
  if (input instanceof Date) return input.getTime();
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Mengekstrak 7 fitur time-series berbasis daya (power_w) & timestamp
 * untuk klasifikasi status mesin ISO 14955-5 menggunakan Random Forest.
 *
 * Catatan penting:
 * - Kolom `sampleIndex` TIDAK digunakan sebagai fitur ML agar model tidak overfit.
 * - Seluruh fitur daya dinormalisasi terhadap `ratedPowerW` agar satu model
 *   bisa menggeneralisasi berbagai kapasitas mesin mebel (1.8 kW – 5.5 kW).
 * - Harus tetap identik dengan fungsi `extract_features()` pada
 *   `ml/wattwise_random_forest.ipynb`.
 */
export function extractFeatures(
  windowSamples: readonly PowerSample[],
  ratedPowerW: number,
  windowSize = 5
): ExtractedFeatures {
  if (windowSamples.length === 0) {
    throw new Error("windowSamples tidak boleh kosong");
  }

  const safeRatedW = Math.max(100, ratedPowerW);
  const recent = windowSamples.slice(-Math.max(1, windowSize));
  const curr = recent[recent.length - 1];
  const prev = recent.length >= 2 ? recent[recent.length - 2] : curr;

  const currPower = Math.max(0, curr.powerW);
  const prevPower = Math.max(0, prev.powerW);

  const currTs = toTimestampMs(curr.recordedAt);
  const prevTs = toTimestampMs(prev.recordedAt);
  const rawDtSec = (currTs - prevTs) / 1000;
  const dtSec = rawDtSec > 0 ? Math.min(rawDtSec, 60) : 2.0;

  const ratios = recent.map((s) => Math.max(0, s.powerW) / safeRatedW);
  const powerRatio = currPower / safeRatedW;
  const prevPowerRatio = prevPower / safeRatedW;
  const deltaPowerRatio = powerRatio - prevPowerRatio;
  const slopePerSec = deltaPowerRatio / dtSec;

  const rollingMeanRatio =
    ratios.reduce((sum, r) => sum + r, 0) / ratios.length;

  const variance =
    ratios.reduce((sum, r) => sum + (r - rollingMeanRatio) ** 2, 0) /
    ratios.length;
  const rollingStdRatio = Math.sqrt(variance);

  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const rollingRangeRatio = maxRatio - minRatio;

  const values: [number, number, number, number, number, number, number] = [
    round6(powerRatio),
    round6(prevPowerRatio),
    round6(deltaPowerRatio),
    round6(slopePerSec),
    round6(rollingMeanRatio),
    round6(rollingStdRatio),
    round6(rollingRangeRatio),
  ];

  const byName = FEATURE_NAMES.reduce(
    (acc, name, idx) => {
      acc[name] = values[idx];
      return acc;
    },
    {} as Record<FeatureName, number>
  );

  return { values, byName, dtSec };
}

function round6(num: number): number {
  return Math.round(num * 1_000_000) / 1_000_000;
}
