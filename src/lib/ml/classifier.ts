import rfModelJson from "./rf-model.json";
import { extractFeatures } from "./features";
import {
  MACHINE_STATUS_CLASSES,
  type ClassificationResult,
  type ExtractedFeatures,
  type HysteresisState,
  type MachineStatus,
  type PowerSample,
  type RfModelArtifact,
  type RfTreeNode,
} from "./types";

const DEFAULT_MODEL = rfModelJson as unknown as RfModelArtifact;

export function getActiveRfModel(): RfModelArtifact {
  return DEFAULT_MODEL;
}

function traverseTree(tree: readonly RfTreeNode[], features: readonly number[]): number[] {
  let idx = 0;
  let guard = 0;
  while (idx >= 0 && idx < tree.length && guard < 64) {
    const node = tree[idx];
    if (node.featureIndex === -1) {
      return node.probs;
    }
    idx = features[node.featureIndex] <= node.threshold ? node.left : node.right;
    guard++;
  }
  return tree[0]?.probs ?? [1, 0, 0, 0];
}

/**
 * Mengeksekusi inferensi ensemble Random Forest langsung di memori (< 1 ms)
 * dari file `rf-model.json` hasil training Python (Google Colab / scikit-learn)
 * atau baseline trainer.
 */
export function predictRandomForest(
  extracted: ExtractedFeatures,
  model: RfModelArtifact = DEFAULT_MODEL
): {
  status: MachineStatus;
  confidence: number;
  probabilities: Record<MachineStatus, number>;
} {
  const classes = model.classes;
  const numClasses = classes.length;
  const accum = new Array<number>(numClasses).fill(0);

  for (const tree of model.trees) {
    const probs = traverseTree(tree, extracted.values);
    for (let c = 0; c < numClasses; c++) {
      accum[c] += probs[c] ?? 0;
    }
  }

  const treeCount = Math.max(1, model.trees.length);
  const probabilities = {} as Record<MachineStatus, number>;

  let bestStatus: MachineStatus = MACHINE_STATUS_CLASSES[0];
  let bestProb = -1;

  for (let c = 0; c < numClasses; c++) {
    const cls = classes[c];
    const avgProb = Number((accum[c] / treeCount).toFixed(4));
    probabilities[cls] = avgProb;
    if (avgProb > bestProb) {
      bestProb = avgProb;
      bestStatus = cls;
    }
  }

  return {
    status: bestStatus,
    confidence: Math.max(0, Math.min(1, bestProb)),
    probabilities,
  };
}

/**
 * Hysteresis / state smoothing sesuai ARCHITECTURE.md:
 * Transisi `WORKING` -> `IDLE` baru dikunci setelah `idleConfirmSamples`
 * berturut-turut (default 2 sampel) agar jeda ganti papan kayu singkat
 * tidak dihitung sebagai idle palsu.
 */
export function applyHysteresis(
  rawStatus: MachineStatus,
  prevState?: HysteresisState,
  idleConfirmSamples = 2
): {
  status: MachineStatus;
  nextState: HysteresisState;
  smoothed: boolean;
} {
  if (!prevState) {
    return {
      status: rawStatus,
      nextState: { stableStatus: rawStatus, pendingIdleCount: 0 },
      smoothed: false,
    };
  }

  if (prevState.stableStatus === "WORKING" && rawStatus === "IDLE") {
    const nextPending = prevState.pendingIdleCount + 1;
    if (nextPending < idleConfirmSamples) {
      return {
        status: "WORKING",
        nextState: { stableStatus: "WORKING", pendingIdleCount: nextPending },
        smoothed: true,
      };
    }
    return {
      status: "IDLE",
      nextState: { stableStatus: "IDLE", pendingIdleCount: 0 },
      smoothed: false,
    };
  }

  return {
    status: rawStatus,
    nextState: { stableStatus: rawStatus, pendingIdleCount: 0 },
    smoothed: false,
  };
}

/**
 * Pipeline klasifikasi end-to-end siap dipanggil dari POST /api/iot/telemetry.
 */
export function classifyTelemetryWindow(params: {
  windowSamples: readonly PowerSample[];
  ratedPowerW: number;
  prevHysteresisState?: HysteresisState;
  idleConfirmSamples?: number;
  model?: RfModelArtifact;
}): {
  result: ClassificationResult;
  nextHysteresisState: HysteresisState;
} {
  const {
    windowSamples,
    ratedPowerW,
    prevHysteresisState,
    idleConfirmSamples = 2,
    model = DEFAULT_MODEL,
  } = params;

  const features = extractFeatures(windowSamples, ratedPowerW, 5);
  const rawPred = predictRandomForest(features, model);
  const smoothed = applyHysteresis(
    rawPred.status,
    prevHysteresisState,
    idleConfirmSamples
  );

  return {
    result: {
      status: smoothed.status,
      rawStatus: rawPred.status,
      confidence: rawPred.confidence,
      probabilities: rawPred.probabilities,
      features,
      smoothedByHysteresis: smoothed.smoothed,
    },
    nextHysteresisState: smoothed.nextState,
  };
}
