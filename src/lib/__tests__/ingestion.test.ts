import assert from "node:assert/strict";
import test from "node:test";
import {
  computeIntervalAccounting,
  DEFAULT_SAMPLE_INTERVAL_SEC,
  MAX_SESSION_GAP_SEC,
  normalizeAndDedupeTelemetryBatch,
} from "../iot/ingestion";

test("normalizeAndDedupeTelemetryBatch sorts chronologically and strips intra-batch duplicates", () => {
  const t1 = "2026-11-27T08:00:00.000Z";
  const t2 = "2026-11-27T08:00:02.000Z";
  const t3 = "2026-11-27T08:00:04.000Z";

  const { items, intraBatchDuplicates } = normalizeAndDedupeTelemetryBatch([
    { index: 3, timestamp: t3, daya: 4200 },
    { index: 1, timestamp: t1, daya: 1500 },
    { index: 2, timestamp: t2, daya: 3900 },
    { index: 2, timestamp: t2, daya: 3900 }, // retry duplicate inside same batch
  ]);

  assert.equal(intraBatchDuplicates, 1);
  assert.equal(items.length, 3);
  assert.equal(items[0].recordedAt.toISOString(), t1);
  assert.equal(items[1].recordedAt.toISOString(), t2);
  assert.equal(items[2].recordedAt.toISOString(), t3);
});

test("computeIntervalAccounting uses cumulative PZEM meter delta instead of mixing cumulative value as interval energy", () => {
  const prev = {
    recordedAt: new Date("2026-11-27T08:00:00.000Z"),
    powerW: 3600,
    cumulativeEnergyKwh: 124.51,
  };

  // 100 detik (melebihi clamp ML 60 detik, tapi masih dalam batas gap 180 detik)
  const currAt = new Date("2026-11-27T08:01:40.000Z");
  const res = computeIntervalAccounting({
    prevReading: prev,
    currRecordedAt: currAt,
    currPowerW: 3600,
    currCumulativeEnergyKwh: 124.61, // selisih tepat 0.100 kWh
    ratedPowerW: 5500,
  });

  assert.equal(res.kind, "CONTINUOUS");
  assert.equal(res.shouldSkip, false);
  assert.equal(res.sessionGapDetected, false);
  assert.equal(res.accountingDtSec, 100); // tidak ter-clamp ke 60s
  assert.equal(res.energySource, "CUMULATIVE_METER");
  assert.equal(res.deltaKwh, 0.1);
});

test("computeIntervalAccounting falls back to trapezoidal integration when cumulative PZEM meter resets", () => {
  const prev = {
    recordedAt: new Date("2026-11-27T08:00:00.000Z"),
    powerW: 2000,
    cumulativeEnergyKwh: 500.0,
  };
  const currAt = new Date("2026-11-27T08:01:30.000Z"); // 90 detik
  const res = computeIntervalAccounting({
    prevReading: prev,
    currRecordedAt: currAt,
    currPowerW: 4000,
    currCumulativeEnergyKwh: 0.05, // meter di-reset ke 0
    ratedPowerW: 5500,
  });

  // Rata-rata trapesium = (2000 + 4000)/2 = 3000 W selama 90 detik = 0.075 kWh
  assert.equal(res.kind, "CONTINUOUS");
  assert.equal(res.energySource, "TRAPEZOIDAL_FALLBACK");
  assert.equal(res.accountingDtSec, 90);
  assert.equal(res.deltaKwh, 0.075);
});

test("computeIntervalAccounting detects connection gap (> 180s) and avoids phantom offline energy", () => {
  const prev = {
    recordedAt: new Date("2026-11-27T08:00:00.000Z"),
    powerW: 4000,
    cumulativeEnergyKwh: 100.0,
  };
  const currAt = new Date(
    prev.recordedAt.getTime() + (MAX_SESSION_GAP_SEC + 120) * 1000
  );

  const res = computeIntervalAccounting({
    prevReading: prev,
    currRecordedAt: currAt,
    currPowerW: 3600,
    currCumulativeEnergyKwh: 101.2,
    ratedPowerW: 5500,
  });

  assert.equal(res.kind, "GAP_RESET");
  assert.equal(res.sessionGapDetected, true);
  assert.equal(res.shouldSkip, false);
  assert.equal(res.accountingDtSec, DEFAULT_SAMPLE_INTERVAL_SEC);
  assert.equal(res.deltaKwh, 0.002); // 3600 W * 2s / 3_600_000 = 0.002 kWh
});

test("computeIntervalAccounting skips duplicate retries and out-of-order late packets", () => {
  const prev = {
    recordedAt: new Date("2026-11-27T08:05:00.000Z"),
    powerW: 3200,
    cumulativeEnergyKwh: 50.2,
  };

  const dup = computeIntervalAccounting({
    prevReading: prev,
    currRecordedAt: new Date("2026-11-27T08:05:00.000Z"),
    currPowerW: 3200,
    currCumulativeEnergyKwh: 50.2,
    ratedPowerW: 5500,
  });
  assert.equal(dup.kind, "DUPLICATE_TIMESTAMP");
  assert.equal(dup.shouldSkip, true);
  assert.equal(dup.deltaKwh, 0);

  const late = computeIntervalAccounting({
    prevReading: prev,
    currRecordedAt: new Date("2026-11-27T08:04:56.000Z"),
    currPowerW: 3100,
    currCumulativeEnergyKwh: 50.19,
    ratedPowerW: 5500,
  });
  assert.equal(late.kind, "OUT_OF_ORDER");
  assert.equal(late.shouldSkip, true);
  assert.equal(late.deltaKwh, 0);
});
