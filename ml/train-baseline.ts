import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { extractFeatures } from "../src/lib/ml/features";
import {
  fetchSpreadsheetDataset,
  parseSpreadsheetDatasetCsv,
} from "../src/lib/ml/spreadsheet-dataset";
import {
  FEATURE_NAMES,
  MACHINE_STATUS_CLASSES,
  type MachineStatus,
  type PowerSample,
  type RfModelArtifact,
  type RfTreeNode,
} from "../src/lib/ml/types";

// =============================================================================
// Deterministic PRNG (LCG) untuk reproduktibilitas eksperimen
// =============================================================================
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function gaussian(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}

// =============================================================================
// CLI Argument Helpers
// =============================================================================
function getCliArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const idx = process.argv.findIndex(
    (arg) => arg === `--${name}` || arg.startsWith(prefix)
  );
  if (idx === -1) return undefined;
  const raw = process.argv[idx];
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function hasCliFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// =============================================================================
// 1. Generator Dataset Time-Series ISO 14955-5 (6 Mesin Mebel — Fallback)
// =============================================================================
interface MachineProfile {
  code: string;
  ratedPowerW: number;
  idleRatio: number;
  workingRatio: number;
  startupPeakRatio: number;
}

const MACHINE_PROFILES: MachineProfile[] = [
  {
    code: "CNC-1325",
    ratedPowerW: 5500,
    idleRatio: 0.3,
    workingRatio: 0.81,
    startupPeakRatio: 1.18,
  },
  {
    code: "EDGE-01",
    ratedPowerW: 4200,
    idleRatio: 0.35,
    workingRatio: 0.8,
    startupPeakRatio: 1.15,
  },
  {
    code: "PSAW-01",
    ratedPowerW: 3800,
    idleRatio: 0.34,
    workingRatio: 0.82,
    startupPeakRatio: 1.2,
  },
  {
    code: "DUST-01",
    ratedPowerW: 2200,
    idleRatio: 0.4,
    workingRatio: 0.84,
    startupPeakRatio: 1.16,
  },
  {
    code: "BOR-01",
    ratedPowerW: 1800,
    idleRatio: 0.27,
    workingRatio: 0.78,
    startupPeakRatio: 1.14,
  },
  {
    code: "COMP-5HP",
    ratedPowerW: 3700,
    idleRatio: 0.29,
    workingRatio: 0.86,
    startupPeakRatio: 1.22,
  },
];

interface LabeledRow {
  features: number[];
  labelIdx: number;
}

function generateSyntheticDataset(rng: () => number): LabeledRow[] {
  const rows: LabeledRow[] = [];
  const dtMs = 2000; // Interval sampling 2 detik

  for (const profile of MACHINE_PROFILES) {
    let tsMs = Date.parse("2026-11-26T08:00:00Z");
    let sampleIndex = 1;
    const history: PowerSample[] = [];

    const pushSample = (powerW: number, label: MachineStatus) => {
      const sample: PowerSample = {
        sampleIndex: sampleIndex++,
        recordedAt: tsMs,
        powerW: Math.max(0, Number(powerW.toFixed(1))),
      };
      tsMs += dtMs;
      history.push(sample);
      if (history.length > 5) history.shift();

      if (history.length >= 3) {
        const extracted = extractFeatures(history, profile.ratedPowerW, 5);
        rows.push({
          features: extracted.values,
          labelIdx: MACHINE_STATUS_CLASSES.indexOf(label),
        });
      }
    };

    // 14 siklus kerja realistis per mesin
    for (let cycle = 0; cycle < 14; cycle++) {
      const offSteps = 10 + Math.floor(rng() * 5);
      for (let i = 0; i < offSteps; i++) {
        const p = Math.max(0, gaussian(rng, 0.004, 0.003) * profile.ratedPowerW);
        pushSample(p, "OFF");
      }

      const startupSteps = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < startupSteps; i++) {
        const decay = 1 - i * 0.08;
        const ratio = gaussian(rng, profile.startupPeakRatio * decay, 0.06);
        pushSample(ratio * profile.ratedPowerW, "START_UP");
      }

      const idle1Steps = 10 + Math.floor(rng() * 5);
      for (let i = 0; i < idle1Steps; i++) {
        const ratio = gaussian(rng, profile.idleRatio, 0.012);
        pushSample(ratio * profile.ratedPowerW, "IDLE");
      }

      const workSteps = 16 + Math.floor(rng() * 7);
      for (let i = 0; i < workSteps; i++) {
        const cuttingWave = Math.sin(i * 1.15) * 0.09;
        const ratio = gaussian(rng, profile.workingRatio + cuttingWave, 0.065);
        pushSample(
          Math.min(1.04, Math.max(0.52, ratio)) * profile.ratedPowerW,
          "WORKING"
        );
      }

      const idle2Steps = 10 + Math.floor(rng() * 5);
      for (let i = 0; i < idle2Steps; i++) {
        const ratio = gaussian(rng, profile.idleRatio, 0.014);
        pushSample(ratio * profile.ratedPowerW, "IDLE");
      }
    }
  }

  return rows;
}

// =============================================================================
// 2. Stratified 80/20 Split + CART Decision Tree & Random Forest Trainer
// =============================================================================
const NUM_CLASSES = MACHINE_STATUS_CLASSES.length;

function stratifiedTrainTestSplit(
  dataset: LabeledRow[],
  rng: () => number,
  trainRatio = 0.8
): { trainRows: LabeledRow[]; testRows: LabeledRow[] } {
  const byClass: LabeledRow[][] = Array.from({ length: NUM_CLASSES }, () => []);
  for (const row of dataset) {
    byClass[row.labelIdx].push(row);
  }

  const trainRows: LabeledRow[] = [];
  const testRows: LabeledRow[] = [];

  for (const bucket of byClass) {
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    if (bucket.length === 0) continue;
    if (bucket.length === 1) {
      trainRows.push(bucket[0]);
      continue;
    }
    const split = Math.max(
      1,
      Math.min(bucket.length - 1, Math.floor(bucket.length * trainRatio))
    );
    trainRows.push(...bucket.slice(0, split));
    testRows.push(...bucket.slice(split));
  }

  return { trainRows, testRows };
}

function classDistribution(indices: number[], rows: LabeledRow[]): number[] {
  const counts = new Array<number>(NUM_CLASSES).fill(0);
  for (const idx of indices) {
    counts[rows[idx].labelIdx]++;
  }
  const total = indices.length || 1;
  return counts.map((c) => Number((c / total).toFixed(4)));
}

function giniFromCounts(counts: number[], total: number): number {
  if (total === 0) return 0;
  let sumSq = 0;
  for (let c = 0; c < counts.length; c++) {
    const p = counts[c] / total;
    sumSq += p * p;
  }
  return 1 - sumSq;
}

function buildCartTree(
  rows: LabeledRow[],
  sampleIndices: number[],
  maxDepth: number,
  minSamplesLeaf: number,
  maxFeatures: number,
  rng: () => number
): RfTreeNode[] {
  const nodes: RfTreeNode[] = [];

  function buildNode(indices: number[], depth: number): number {
    const nodeIdx = nodes.length;
    const probs = classDistribution(indices, rows);

    const maxProb = Math.max(...probs);
    if (
      depth >= maxDepth ||
      indices.length < minSamplesLeaf * 2 ||
      maxProb >= 0.999
    ) {
      nodes.push({
        featureIndex: -1,
        threshold: 0,
        left: -1,
        right: -1,
        probs,
      });
      return nodeIdx;
    }

    const allFeatureIds = FEATURE_NAMES.map((_, i) => i);
    for (let i = allFeatureIds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allFeatureIds[i], allFeatureIds[j]] = [allFeatureIds[j], allFeatureIds[i]];
    }
    const candidateFeatures = allFeatureIds.slice(0, maxFeatures);

    let bestFeature = -1;
    let bestThreshold = 0;
    let bestImpurity = Number.POSITIVE_INFINITY;

    const totalCount = indices.length;
    const totalCounts = new Array<number>(NUM_CLASSES).fill(0);
    for (const idx of indices) totalCounts[rows[idx].labelIdx]++;

    for (const featIdx of candidateFeatures) {
      const pairs = indices
        .map((rowIdx) => ({
          val: rows[rowIdx].features[featIdx],
          cls: rows[rowIdx].labelIdx,
        }))
        .sort((a, b) => a.val - b.val);

      const leftCounts = new Array<number>(NUM_CLASSES).fill(0);
      const rightCounts = [...totalCounts];

      for (let i = 0; i < pairs.length - 1; i++) {
        const cls = pairs[i].cls;
        leftCounts[cls]++;
        rightCounts[cls]--;

        const leftTotal = i + 1;
        const rightTotal = totalCount - leftTotal;
        if (leftTotal < minSamplesLeaf || rightTotal < minSamplesLeaf) continue;
        if (pairs[i].val === pairs[i + 1].val) continue;

        const weightedGini =
          (leftTotal / totalCount) * giniFromCounts(leftCounts, leftTotal) +
          (rightTotal / totalCount) * giniFromCounts(rightCounts, rightTotal);

        if (weightedGini < bestImpurity) {
          bestImpurity = weightedGini;
          bestFeature = featIdx;
          bestThreshold = (pairs[i].val + pairs[i + 1].val) / 2;
        }
      }
    }

    if (bestFeature === -1) {
      nodes.push({
        featureIndex: -1,
        threshold: 0,
        left: -1,
        right: -1,
        probs,
      });
      return nodeIdx;
    }

    const leftIndices: number[] = [];
    const rightIndices: number[] = [];
    for (const idx of indices) {
      if (rows[idx].features[bestFeature] <= bestThreshold) {
        leftIndices.push(idx);
      } else {
        rightIndices.push(idx);
      }
    }

    nodes.push({
      featureIndex: bestFeature,
      threshold: Number(bestThreshold.toFixed(6)),
      left: -1,
      right: -1,
      probs,
    });

    const leftId = buildNode(leftIndices, depth + 1);
    const rightId = buildNode(rightIndices, depth + 1);
    nodes[nodeIdx].left = leftId;
    nodes[nodeIdx].right = rightId;

    return nodeIdx;
  }

  buildNode(sampleIndices, 0);
  return nodes;
}

function predictTreeProbs(tree: RfTreeNode[], features: number[]): number[] {
  let nodeId = 0;
  while (tree[nodeId].featureIndex !== -1) {
    const node = tree[nodeId];
    nodeId = features[node.featureIndex] <= node.threshold ? node.left : node.right;
  }
  return tree[nodeId].probs;
}

function predictEnsembleClass(trees: RfTreeNode[][], features: number[]): number {
  const avgProbs = new Array<number>(NUM_CLASSES).fill(0);
  for (const tree of trees) {
    const probs = predictTreeProbs(tree, features);
    for (let c = 0; c < NUM_CLASSES; c++) avgProbs[c] += probs[c];
  }
  let bestCls = 0;
  for (let c = 1; c < NUM_CLASSES; c++) {
    if (avgProbs[c] > avgProbs[bestCls]) bestCls = c;
  }
  return bestCls;
}

async function main() {
  const rng = createRng(20261126);

  const sheetUrl =
    getCliArg("sheet") ??
    getCliArg("url") ??
    process.env.ML_DATASET_SHEET_URL?.trim();
  const localCsvPath = getCliArg("csv");
  const gid = getCliArg("gid");
  const sheetName = getCliArg("sheet-name");
  const defaultRatedPowerW = Number(getCliArg("rated-power") ?? "3800") || 3800;
  const defaultMachineCode = getCliArg("machine") ?? "MESIN-01";
  const autoLabel = hasCliFlag("auto-label");
  const nEstimators = Math.max(5, Math.min(100, Number(getCliArg("trees") ?? "25") || 25));
  const maxDepth = Math.max(3, Math.min(15, Number(getCliArg("max-depth") ?? "7") || 7));
  const outArg = getCliArg("out");

  let dataset: LabeledRow[];
  let trainedWith =
    "wattwise-baseline-cart-rf (compatible with scikit-learn Colab export)";
  let sourceSummary = "Synthetic ISO 14955-5 (6 mesin furnitur)";

  if (sheetUrl) {
    console.log(`[ML] Mengambil dataset dari Google Sheets / URL...`);
    const fetched = await fetchSpreadsheetDataset(sheetUrl, {
      gid,
      sheetName,
      defaultRatedPowerW,
      defaultMachineCode,
      autoLabelIfMissingStatus: autoLabel,
    });
    dataset = fetched.rows;
    trainedWith = fetched.usedAutoLabel
      ? "google-sheets-cart-rf (auto-labeled ISO 14955-5)"
      : "google-sheets-cart-rf";
    sourceSummary = `${fetched.csvUrl} (mesin: ${fetched.machineCodes.join(", ")}, baris mentah: ${fetched.rawRowCount}, dilewati: ${fetched.skippedRowCount})`;
    console.log(`[ML] Header terdeteksi : ${fetched.detectedHeaders.join(", ")}`);
    console.log(`[ML] Distribusi kelas  :`, fetched.classCounts);
    if (fetched.usedAutoLabel) {
      console.warn(
        "[ML] Peringatan: Kolom 'status' tidak ada; label dibuat otomatis berbasis aturan ISO 14955-5 (--auto-label)."
      );
    }
  } else if (localCsvPath) {
    const resolvedCsv = path.resolve(process.cwd(), localCsvPath);
    const csvText = fs.readFileSync(resolvedCsv, "utf-8");
    const parsed = parseSpreadsheetDatasetCsv(csvText, {
      defaultRatedPowerW,
      defaultMachineCode,
      autoLabelIfMissingStatus: autoLabel,
    });
    dataset = parsed.rows;
    trainedWith = parsed.usedAutoLabel
      ? "local-csv-cart-rf (auto-labeled ISO 14955-5)"
      : "local-csv-cart-rf";
    sourceSummary = `${resolvedCsv} (mesin: ${parsed.machineCodes.join(", ")}, baris mentah: ${parsed.rawRowCount})`;
    console.log(`[ML] Distribusi kelas  :`, parsed.classCounts);
  } else {
    dataset = generateSyntheticDataset(rng);
  }

  const { trainRows, testRows } = stratifiedTrainTestSplit(dataset, rng, 0.8);
  const minSamplesLeaf = Math.max(2, Math.min(4, Math.floor(trainRows.length / 40)));
  const maxFeatures = 3;

  const trees: RfTreeNode[][] = [];
  for (let t = 0; t < nEstimators; t++) {
    const bootIndices: number[] = [];
    for (let i = 0; i < trainRows.length; i++) {
      bootIndices.push(Math.floor(rng() * trainRows.length));
    }
    trees.push(
      buildCartTree(
        trainRows,
        bootIndices,
        maxDepth,
        minSamplesLeaf,
        maxFeatures,
        rng
      )
    );
  }

  const confusion: number[][] = Array.from({ length: NUM_CLASSES }, () =>
    new Array<number>(NUM_CLASSES).fill(0)
  );
  let correct = 0;
  for (const row of testRows) {
    const pred = predictEnsembleClass(trees, row.features);
    confusion[row.labelIdx][pred]++;
    if (pred === row.labelIdx) correct++;
  }

  const accuracy = testRows.length > 0 ? correct / testRows.length : 1;
  const perClassF1 = {} as Record<MachineStatus, number>;
  for (let c = 0; c < NUM_CLASSES; c++) {
    const tp = confusion[c][c];
    const fp = confusion.reduce((s, r, idx) => s + (idx === c ? 0 : r[c]), 0);
    const fn = confusion[c].reduce((s, v, idx) => s + (idx === c ? 0 : v), 0);
    const f1 = tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
    perClassF1[MACHINE_STATUS_CLASSES[c]] = Number(f1.toFixed(4));
  }

  const artifact: RfModelArtifact = {
    version: "1.0.0",
    modelType: "RandomForestClassifier",
    standard: "ISO 14955-5:2020",
    trainedAt: new Date().toISOString(),
    trainedWith,
    classes: [...MACHINE_STATUS_CLASSES],
    featureNames: [...FEATURE_NAMES],
    nEstimators,
    maxDepth,
    metrics: {
      testAccuracy: Number(accuracy.toFixed(4)),
      trainSamples: trainRows.length,
      testSamples: testRows.length,
      perClassF1,
    },
    trees,
  };

  const outPath = path.resolve(
    process.cwd(),
    outArg ?? "src/lib/ml/rf-model.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(artifact), "utf-8");

  console.log("=== WattWise Random Forest Training ===");
  console.log(`Sumber data   : ${sourceSummary}`);
  console.log(`Total samples : ${dataset.length} (train: ${trainRows.length}, test: ${testRows.length})`);
  console.log(`Trees / Depth : ${nEstimators} trees, maxDepth=${maxDepth}`);
  console.log(`Test Accuracy : ${(accuracy * 100).toFixed(2)}%`);
  console.log("Per-class F1  :", perClassF1);
  console.log("Confusion Matrix (rows=actual, cols=pred) [OFF, START_UP, IDLE, WORKING]:");
  confusion.forEach((row, idx) => {
    console.log(`  ${MACHINE_STATUS_CLASSES[idx].padEnd(9)} -> [${row.join(", ")}]`);
  });
  console.log(`Saved model   : ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error("[ML Training Error]", err instanceof Error ? err.message : err);
  process.exit(1);
});
