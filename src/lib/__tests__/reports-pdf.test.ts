import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardOverviewResponse } from "../dashboard/service";
import {
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
} from "../mock-dashboard-data";
import { generateAuditPdfBytes } from "../reports/pdf-generator";

function buildFixtureOverview(): DashboardOverviewResponse {
  return {
    dataSource: "database",
    workshop: {
      id: "ws-test-1",
      code: WORKSHOP_INFO.code,
      name: WORKSHOP_INFO.name,
      location: WORKSHOP_INFO.location,
      tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
      workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
      esp32OnlineCount: 6,
      esp32TotalCount: 7,
    },
    metrics: PERIOD_METRICS.month,
    machines: INITIAL_MACHINES,
    virtualSensor: VIRTUAL_SENSOR_SUMMARY,
    actionLogs: INITIAL_ACTION_LOGS,
  };
}

test("generateAuditPdfBytes creates a valid binary PDF for all machines with SEC and recommendations", async () => {
  const bytes = await generateAuditPdfBytes({
    overview: buildFixtureOverview(),
    range: "month",
    scope: "ALL",
    secSummary: {
      totalOutputUnits: 51,
      secKwhPerUnit: 21.71,
    },
    generatedAt: new Date("2026-11-27T10:00:00Z"),
  });

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.byteLength > 2000, `PDF terlalu kecil: ${bytes.byteLength} bytes`);

  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  const tail = Buffer.from(bytes.slice(-16)).toString("ascii");
  assert.equal(header, "%PDF-");
  assert.ok(tail.includes("%%EOF"), `Trailer PDF tidak valid: ${tail}`);
});

test("generateAuditPdfBytes supports single-machine scope without SEC summary", async () => {
  const bytes = await generateAuditPdfBytes({
    overview: buildFixtureOverview(),
    range: "week",
    scope: "CNC-1325",
    secSummary: null,
    generatedAt: new Date("2026-11-27T10:00:00Z"),
  });

  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  assert.equal(header, "%PDF-");
  assert.ok(bytes.byteLength > 1500);
});
