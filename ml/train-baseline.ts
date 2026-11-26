import fs from "node:fs";
import path from "node:path";
import { extractFeatures } from "../src/lib/ml/features";
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
// 1. Generator Dataset Time-Series ISO 14955-5 (6 Mesin Mebel)
//    Format dasar identik dengan 3 kolom dari hardware: (index, timestamp, powerW)
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
      // 1. OFF (10-14 sampel)
      const offSteps = 10 + Math.floor(rng() * 5);
      for (let i = 0; i < offSteps; i++) {
        const p = Math.max(0, gaussian(rng, 0.004, 0.003) * profile.ratedPowerW);
        pushSample(p, "OFF");
      }

      // 2. START_UP (3-5 sampel: lonjakan arus inrush dari OFF lalu melandai)
      const startupSteps = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < startupSteps; i++) {
        const decay = 1 - i * 0.08;
        const ratio = gaussian(rng, profile.startupPeakRatio * decay, 0.06);
        pushSample(ratio * profile.ratedPowerW, "START_UP");
      }

      // 3. IDLE awal sebelum potong material (10-14 sampel: daya datar / std rendah)
      const idle1Steps = 10 + Math.floor(rng() * 5);
      for (let i = 0; i < idle1Steps; i++) {
        const ratio = gaussian(rng, profile.idleRatio, 0.012);
        pushSample(ratio * profile.ratedPowerW, "IDLE");
      }

      // 4. WORKING (16-22 sampel: beban pemotongan kayu berfluktuasi / std tinggi)
      const workSteps = 16 + Math.floor(rng() * 7);
      for (let i = 0; i < workSteps; i++) {
        const cuttingWave = Math.sin(i * 1.15) * 0.09;
        const ratio = gaussian(rng, profile.workingRatio + cuttingWave, 0.065);
        pushSample(
          Math.min(1.04, Math.max(0.52, ratio)) * profile.ratedPowerW,
          "WORKING"
        );
      }

      // 5. IDLE pasca potong (10-14 sampel)
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
// 2. CART Decision Tree & Random Forest Trainer (Gini Impurity + Bagging)
// =============================================================================
const NUM_CLASSES = MACHINE_STATUS_CLASSES.length;

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

    // Pilih subset fitur acak (Random Subspace Method)
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

    // Reserve current node slot before recursing
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

function main() {
  const rng = createRng(20261126);
  const dataset = generateSyntheticDataset(rng);

  // Shuffle deterministik + split 80/20
  for (let i = dataset.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
  }

  const splitIdx = Math.floor(dataset.length * 0.8);
  const trainRows = dataset.slice(0, splitIdx);
  const testRows = dataset.slice(splitIdx);

  const nEstimators = 25;
  const maxDepth = 7;
  const minSamplesLeaf = 4;
  const maxFeatures = 3;

  const trees: RfTreeNode[][] = [];
  for (let t = 0; t < nEstimators; t++) {
    // Bootstrap sampling
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

  // Evaluasi pada test set
  const confusion: number[][] = Array.from({ length: NUM_CLASSES }, () =>
    new Array<number>(NUM_CLASSES).fill(0)
  );
  let correct = 0;
  for (const row of testRows) {
    const pred = predictEnsembleClass(trees, row.features);
    confusion[row.labelIdx][pred]++;
    if (pred === row.labelIdx) correct++;
  }

  const accuracy = correct / testRows.length;
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
    trainedWith: "wattwise-baseline-cart-rf (compatible with scikit-learn Colab export)",
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

  const outPath = path.resolve(process.cwd(), "src/lib/ml/rf-model.json");
  fs.writeFileSync(outPath, JSON.stringify(artifact), "utf-8");

  console.log("=== WattWise Random Forest Baseline Training ===");
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

main();
