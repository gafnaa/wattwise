import assert from "node:assert/strict";
import test from "node:test";
import {
  buildParetoIdleLoss,
  calculateCostIdr,
  calculateEnergyKwhFromPower,
  calculateIsoOperationalEfficiency,
  calculateSpecificEnergyConsumption,
  calculateWhatIfProjection,
  integrateTimeSeriesEnergyKwh,
} from "../audit/calculator";
import {
  formatTelegramSummaryReport,
  formatTelegramUrgentAlert,
  generateMachineRecommendations,
  shouldTriggerUrgentIdleAlert,
} from "../audit/recommendations";
import { calculateVirtualSensorPower } from "../audit/virtual-sensor";
import {
  applyHysteresis,
  classifyTelemetryWindow,
  getActiveRfModel,
} from "../ml/classifier";
import { extractFeatures } from "../ml/features";
import type { HysteresisState, PowerSample } from "../ml/types";

test("extractFeatures works with 3-column hardware payload (index, timestamp, powerW)", () => {
  const baseTs = Date.parse("2026-11-26T09:00:00Z");
  const window: PowerSample[] = [
    { sampleIndex: 1, recordedAt: baseTs, powerW: 1310 },
    { sampleIndex: 2, recordedAt: baseTs + 2000, powerW: 1320 },
    { sampleIndex: 3, recordedAt: baseTs + 4000, powerW: 1315 },
    { sampleIndex: 4, recordedAt: baseTs + 6000, powerW: 1325 },
    { sampleIndex: 5, recordedAt: baseTs + 8000, powerW: 1320 },
  ];

  const extracted = extractFeatures(window, 3800);
  assert.equal(extracted.values.length, 7);
  assert.equal(extracted.dtSec, 2);
  assert.ok(extracted.byName.power_ratio > 0.34 && extracted.byName.power_ratio < 0.35);
  assert.ok(extracted.byName.rolling_std_ratio < 0.01);
});

test("Random Forest classifier accurately predicts OFF, START_UP, IDLE, and WORKING", () => {
  const model = getActiveRfModel();
  assert.equal(model.modelType, "RandomForestClassifier");
  assert.ok(model.trees.length >= 20);

  const ratedW = 3800; // Panel Saw Sliding
  const t0 = Date.parse("2026-11-26T09:00:00Z");

  // 1. OFF
  const offWindow: PowerSample[] = [
    { sampleIndex: 1, recordedAt: t0, powerW: 4 },
    { sampleIndex: 2, recordedAt: t0 + 2000, powerW: 3 },
    { sampleIndex: 3, recordedAt: t0 + 4000, powerW: 4 },
  ];
  const offRes = classifyTelemetryWindow({ windowSamples: offWindow, ratedPowerW: ratedW });
  assert.equal(offRes.result.status, "OFF");
  assert.ok(offRes.result.confidence >= 0.8);

  // 2. START_UP (lonjakan inrush dari OFF)
  const startupWindow: PowerSample[] = [
    { sampleIndex: 3, recordedAt: t0 + 4000, powerW: 4 },
    { sampleIndex: 4, recordedAt: t0 + 6000, powerW: 4520 },
    { sampleIndex: 5, recordedAt: t0 + 8000, powerW: 4280 },
  ];
  const startupRes = classifyTelemetryWindow({
    windowSamples: startupWindow,
    ratedPowerW: ratedW,
  });
  assert.equal(startupRes.result.status, "START_UP");

  // 3. IDLE (daya sedang dan stabil / std rendah)
  const idleWindow: PowerSample[] = [
    { sampleIndex: 10, recordedAt: t0 + 20000, powerW: 1315 },
    { sampleIndex: 11, recordedAt: t0 + 22000, powerW: 1325 },
    { sampleIndex: 12, recordedAt: t0 + 24000, powerW: 1320 },
    { sampleIndex: 13, recordedAt: t0 + 26000, powerW: 1310 },
    { sampleIndex: 14, recordedAt: t0 + 28000, powerW: 1322 },
  ];
  const idleRes = classifyTelemetryWindow({ windowSamples: idleWindow, ratedPowerW: ratedW });
  assert.equal(idleRes.result.status, "IDLE");

  // 4. WORKING (daya tinggi dan berfluktuasi saat memotong kayu)
  const workWindow: PowerSample[] = [
    { sampleIndex: 20, recordedAt: t0 + 40000, powerW: 2820 },
    { sampleIndex: 21, recordedAt: t0 + 42000, powerW: 3420 },
    { sampleIndex: 22, recordedAt: t0 + 44000, powerW: 2950 },
    { sampleIndex: 23, recordedAt: t0 + 46000, powerW: 3510 },
    { sampleIndex: 24, recordedAt: t0 + 48000, powerW: 3180 },
  ];
  const workRes = classifyTelemetryWindow({ windowSamples: workWindow, ratedPowerW: ratedW });
  assert.equal(workRes.result.status, "WORKING");
});

test("Hysteresis smoothing prevents false WORKING -> IDLE flicker on single-sample dip", () => {
  const initial: HysteresisState = { stableStatus: "WORKING", pendingIdleCount: 0 };

  // Sampel IDLE pertama ditahan tetap WORKING
  const firstDip = applyHysteresis("IDLE", initial, 2);
  assert.equal(firstDip.status, "WORKING");
  assert.equal(firstDip.smoothed, true);
  assert.equal(firstDip.nextState.pendingIdleCount, 1);

  // Sampel IDLE kedua berturut-turut mengunci transisi ke IDLE
  const secondDip = applyHysteresis("IDLE", firstDip.nextState, 2);
  assert.equal(secondDip.status, "IDLE");
  assert.equal(secondDip.smoothed, false);
  assert.equal(secondDip.nextState.stableStatus, "IDLE");
});

test("Virtual Sensor aggregates non-priority load, ignores stale sensors, and clamps negative noise", () => {
  const now = Date.parse("2026-11-26T09:15:00Z");

  const normal = calculateVirtualSensorPower({
    mainMeterPowerW: 9200,
    mainMeterRecordedAt: now,
    priorityReadings: [
      { machineId: "m1", machineCode: "CNC-1325", powerW: 4400, recordedAt: now - 3000 },
      { machineId: "m2", machineCode: "EDGE-01", powerW: 1500, recordedAt: now - 4000 },
      { machineId: "m3", machineCode: "PSAW-01", powerW: 1300, recordedAt: now - 25_000 }, // stale (>15s)
    ],
  });

  assert.equal(normal.includedSensorCount, 2);
  assert.equal(normal.staleSensorCount, 1);
  assert.equal(normal.priorityTotalPowerW, 5900);
  assert.equal(normal.virtualPowerW, 3300);
  assert.equal(normal.wasClampedToZero, false);

  const clamped = calculateVirtualSensorPower({
    mainMeterPowerW: 4000,
    mainMeterRecordedAt: now,
    priorityReadings: [
      { machineId: "m1", machineCode: "CNC-1325", powerW: 4200, recordedAt: now },
    ],
  });
  assert.equal(clamped.virtualPowerW, 0);
  assert.equal(clamped.wasClampedToZero, true);
});

test("Energy audit calculator computes numerical kWh, ISO efficiency, SEC, Pareto, and What-If", () => {
  // 3600 W selama 10 detik = 0.01 kWh
  assert.equal(calculateEnergyKwhFromPower(3600, 10), 0.01);

  // Integrasi numerik time-series 3600 W konstan selama 10 detik (5 interval x 2 detik)
  const t0 = Date.parse("2026-11-26T09:00:00Z");
  const samples: PowerSample[] = Array.from({ length: 6 }, (_, i) => ({
    sampleIndex: i + 1,
    recordedAt: t0 + i * 2000,
    powerW: 3600,
  }));
  assert.equal(integrateTimeSeriesEnergyKwh(samples), 0.01);

  assert.equal(calculateCostIdr(10, 1444.7), 14447);

  const iso = calculateIsoOperationalEfficiency({
    workingKwh: 1169,
    idleKwh: 316,
    startupKwh: 95,
  });
  assert.equal(iso.efficiencyPct, 74);
  assert.equal(iso.category, "Baik");

  assert.equal(calculateSpecificEnergyConsumption(1580, 50), 31.6);

  const whatIf = calculateWhatIfProjection({
    idleReductionMinPerDay: 30,
    startupReductionPct: 50,
    avgTotalIdlePowerKw: 6.9,
    monthlyStartupCount: 600,
    tariffIdrPerKwh: 1444.7,
    workingDaysPerMonth: 26,
  });
  assert.ok(whatIf.totalSavedKwhMonth > 90);
  assert.ok(whatIf.totalSavingIdrMonth > 130_000);

  const pareto = buildParetoIdleLoss(
    [
      {
        machineId: "m1",
        machineCode: "PSAW-01",
        machineName: "Panel Saw Sliding",
        status: "IDLE",
        durationSec: 7200,
        energyKwh: 100,
      },
      {
        machineId: "m2",
        machineCode: "EDGE-01",
        machineName: "Edge Bander Auto",
        status: "IDLE",
        durationSec: 3600,
        energyKwh: 50,
      },
    ],
    1444.7
  );
  assert.equal(pareto[0].machineCode, "PSAW-01");
  assert.equal(pareto[0].shareOfTotalIdlePct, 66.7);
});

test("Recommendations engine and Telegram 30-min alert cooldown work properly", () => {
  const now = new Date("2026-11-26T10:00:00Z");

  // Trigger aktif saat idle >= threshold dan belum pernah kirim alert
  assert.equal(
    shouldTriggerUrgentIdleAlert({
      machineStatus: "IDLE",
      idleDurationMin: 22,
      idleAlertThresholdMin: 15,
      lastAlertSentAt: null,
      now,
    }),
    true
  );

  // Diblokir oleh cooldown 30 menit jika baru kirim 10 menit lalu
  assert.equal(
    shouldTriggerUrgentIdleAlert({
      machineStatus: "IDLE",
      idleDurationMin: 32,
      idleAlertThresholdMin: 15,
      lastAlertSentAt: new Date("2026-11-26T09:50:00Z"),
      now,
      cooldownMin: 30,
    }),
    false
  );

  const recs = generateMachineRecommendations([
    {
      machineId: "m1",
      machineCode: "EDGE-01",
      machineName: "Edge Bander Auto",
      machineType: "EDGE_BANDER",
      idleHoursMonth: 60,
      idleKwhMonth: 88,
      idleLossIdrMonth: 1_040_000,
      startupCountMonth: 130,
    },
  ]);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "HIGH");
  assert.ok(recs[0].estimatedSavingIdrMonth > 300_000);

  const urgentMsg = formatTelegramUrgentAlert({
    workshopName: "Area Produksi Furnitur",
    machineName: "Edge Bander Auto",
    idleDurationMin: 25,
    currentPowerW: 1480,
    estimatedLossThisSessionIdr: 890,
  });
  assert.match(urgentMsg, /Edge Bander Auto/);

  const summaryMsg = formatTelegramSummaryReport({
    workshopName: "Pabrik Furnitur",
    totalIdleLossIdr: 3_450_000,
    topMachineNames: ["Edge Bander Auto", "CNC Router 1325"],
    suggestedIdleReductionMinPerDay: 30,
    projectedMonthlySavingIdr: 1_449_990,
  });
  assert.match(summaryMsg, /Laporan Hemat Energi/);
});
