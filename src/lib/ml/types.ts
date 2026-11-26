export type MachineStatus = "OFF" | "START_UP" | "IDLE" | "WORKING";

export const MACHINE_STATUS_CLASSES: readonly MachineStatus[] = [
  "OFF",
  "START_UP",
  "IDLE",
  "WORKING",
] as const;

export const FEATURE_NAMES = [
  "power_ratio",
  "prev_power_ratio",
  "delta_power_ratio",
  "slope_per_sec",
  "rolling_mean_ratio",
  "rolling_std_ratio",
  "rolling_range_ratio",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/**
 * Representasi satu baris pembacaan sensor.
 * Kompatibel dengan format 3-kolom hardware (index, timestamp, powerW)
 * sekaligus mendukung atribut opsional dari PZEM-004T.
 */
export interface PowerSample {
  sampleIndex?: number | null;
  recordedAt: Date | string | number;
  powerW: number;
  voltageV?: number | null;
  currentA?: number | null;
  powerFactor?: number | null;
  energyKwh?: number | null;
}

export interface ExtractedFeatures {
  values: [number, number, number, number, number, number, number];
  byName: Record<FeatureName, number>;
  dtSec: number;
}

/**
 * Node pohon keputusan yang 100% kompatibel dengan struktur `sklearn.tree_.Tree`
 * (leaf node memiliki `featureIndex === -1`).
 */
export interface RfTreeNode {
  featureIndex: number;
  threshold: number;
  left: number;
  right: number;
  /** Distribusi probabilitas kelas sesuai urutan `classes` (panjang 4) */
  probs: number[];
}

export interface RfModelArtifact {
  version: string;
  modelType: "RandomForestClassifier";
  standard: "ISO 14955-5:2020";
  trainedAt: string;
  trainedWith: string;
  classes: MachineStatus[];
  featureNames: FeatureName[];
  nEstimators: number;
  maxDepth: number;
  metrics?: {
    testAccuracy: number;
    trainSamples: number;
    testSamples: number;
    perClassF1?: Record<MachineStatus, number>;
  };
  trees: RfTreeNode[][];
}

export interface ClassificationResult {
  status: MachineStatus;
  rawStatus: MachineStatus;
  confidence: number;
  probabilities: Record<MachineStatus, number>;
  features: ExtractedFeatures;
  smoothedByHysteresis: boolean;
}

export interface HysteresisState {
  stableStatus: MachineStatus;
  pendingIdleCount: number;
}
