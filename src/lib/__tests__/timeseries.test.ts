import assert from "node:assert/strict";
import test from "node:test";
import { buildEnergyTimeseriesFromSessions } from "../audit/timeseries";

test("buildEnergyTimeseriesFromSessions aggregates daily current vs previous 14-day buckets in WIB", () => {
  const now = new Date("2026-11-27T05:00:00.000Z"); // 2026-11-27 12:00 WIB
  const series = buildEnergyTimeseriesFromSessions({
    now,
    granularity: "daily",
    tariffIdrPerKwh: 1444.7,
    sessions: [
      {
        startedAt: new Date("2026-11-27T02:00:00.000Z"), // 27 Nov WIB (today)
        status: "WORKING",
        energyKwh: 42.5,
      },
      {
        startedAt: new Date("2026-11-27T04:00:00.000Z"), // 27 Nov WIB (today)
        status: "IDLE",
        energyKwh: 7.5,
      },
      {
        startedAt: new Date("2026-11-13T03:00:00.000Z"), // 14 days before 27 Nov -> previous bucket of 27 Nov
        status: "WORKING",
        energyKwh: 61.0,
      },
    ],
  });

  assert.equal(series.length, 14);
  const last = series[series.length - 1];
  assert.equal(last?.bucketKey, "2026-11-27");
  assert.equal(last?.currentKwh, 50);
  assert.equal(last?.workingKwh, 42.5);
  assert.equal(last?.idleKwh, 7.5);
  assert.equal(last?.previousKwh, 61);
  assert.equal(last?.estCostIdr, Math.round(50 * 1444.7));
});

test("buildEnergyTimeseriesFromSessions builds 4 weekly and 6 monthly buckets cleanly", () => {
  const now = new Date("2026-11-27T05:00:00.000Z");

  const weekly = buildEnergyTimeseriesFromSessions({
    now,
    granularity: "weekly",
    tariffIdrPerKwh: 1444.7,
    sessions: [
      {
        startedAt: new Date("2026-11-25T03:00:00.000Z"),
        status: "WORKING",
        energyKwh: 120,
      },
      {
        startedAt: new Date("2026-10-28T03:00:00.000Z"), // 28 days earlier -> prev week 4
        status: "WORKING",
        energyKwh: 95,
      },
    ],
  });

  assert.equal(weekly.length, 4);
  assert.equal(weekly[3]?.currentKwh, 120);
  assert.equal(weekly[3]?.previousKwh, 95);

  const monthly = buildEnergyTimeseriesFromSessions({
    now,
    granularity: "monthly",
    tariffIdrPerKwh: 1444.7,
    sessions: [
      {
        startedAt: new Date("2026-11-10T03:00:00.000Z"),
        status: "WORKING",
        energyKwh: 800,
      },
      {
        startedAt: new Date("2026-05-10T03:00:00.000Z"),
        status: "WORKING",
        energyKwh: 740,
      },
    ],
  });

  assert.equal(monthly.length, 6);
  assert.equal(monthly[5]?.label, "Nov");
  assert.equal(monthly[5]?.currentKwh, 800);
  assert.equal(monthly[5]?.previousKwh, 740);
});
