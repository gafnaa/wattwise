import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMachineStatusLabel,
  parseCsvText,
  parseSpreadsheetDatasetCsv,
  resolveSpreadsheetCsvUrl,
} from "../ml/spreadsheet-dataset";

test("resolveSpreadsheetCsvUrl converts Google Sheets edit, gid, sheetName, and pubhtml links cleanly", () => {
  const stdEdit = resolveSpreadsheetCsvUrl(
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=987654"
  );
  assert.equal(
    stdEdit,
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=987654"
  );

  const queryGid = resolveSpreadsheetCsvUrl(
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?gid=42&usp=sharing"
  );
  assert.equal(
    queryGid,
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=42"
  );

  const namedSheet = resolveSpreadsheetCsvUrl(
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing",
    { sheetName: "Dataset CNC" }
  );
  assert.equal(
    namedSheet,
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/gviz/tq?tqx=out%3Acsv&sheet=Dataset+CNC"
  );

  const pubHtml = resolveSpreadsheetCsvUrl(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTestSheetId/pubhtml?gid=0&single=true"
  );
  assert.equal(
    pubHtml,
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTestSheetId/pub?gid=0&single=true&output=csv"
  );

  const directCsv = resolveSpreadsheetCsvUrl("https://example.com/wattwise.csv");
  assert.equal(directCsv, "https://example.com/wattwise.csv");
});

test("parseSpreadsheetDatasetCsv parses labeled spreadsheet CSV with flexible Indonesian headers", () => {
  const lines = [
    "No,Waktu,Daya,Status,Kode Mesin,Kapasitas W",
    ...Array.from({ length: 6 }, (_, i) =>
      `${i + 1},2026-11-27 08:00:${String(i * 2).padStart(2, "0")},4,Mati,CNC-1325,5500`
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      `${i + 7},2026-11-27 08:00:${String((i + 6) * 2).padStart(2, "0")},6200,Startup,CNC-1325,5500`
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      `${i + 11},2026-11-27 08:00:${String((i + 10) * 2).padStart(2, "0")},"1.650,5",Siaga,CNC-1325,5500`
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      `${i + 17},2026-11-27 08:00:${String((i + 16) * 2).padStart(2, "0")},${4200 + (i % 2) * 450},Bekerja,CNC-1325,5500`
    ),
  ];

  const parsed = parseSpreadsheetDatasetCsv(lines.join("\n"));
  assert.equal(parsed.usedAutoLabel, false);
  assert.equal(parsed.skippedRowCount, 0);
  assert.deepEqual(parsed.machineCodes, ["CNC-1325"]);
  assert.equal(parsed.rows.length, 22); // 24 rows - 2 warmup samples
  assert.equal(parsed.rows[0].features.length, 7);
  assert.equal(parsed.classCounts.OFF, 4);
  assert.equal(parsed.classCounts.START_UP, 4);
  assert.equal(parsed.classCounts.IDLE, 6);
  assert.equal(parsed.classCounts.WORKING, 8);
});

test("parseSpreadsheetDatasetCsv rejects private Google HTML pages and supports --auto-label on 3-column CSV", () => {
  assert.throws(
    () => parseSpreadsheetDatasetCsv("<!DOCTYPE html><html><title>Sign in</title></html>"),
    /Anyone with the link/
  );

  const unlabeled = [
    "index,timestamp,daya",
    ...Array.from({ length: 6 }, (_, i) => `${i + 1},2026-11-27T08:00:${String(i * 2).padStart(2, "0")}Z,5`),
    ...Array.from({ length: 6 }, (_, i) => `${i + 7},2026-11-27T08:00:${String((i + 6) * 2).padStart(2, "0")}Z,1250`),
    ...Array.from({ length: 6 }, (_, i) => `${i + 13},2026-11-27T08:00:${String((i + 12) * 2).padStart(2, "0")}Z,${3100 + (i % 2) * 300}`),
  ].join("\n");

  assert.throws(() => parseSpreadsheetDatasetCsv(unlabeled), /--auto-label/);

  const auto = parseSpreadsheetDatasetCsv(unlabeled, {
    defaultRatedPowerW: 3800,
    autoLabelIfMissingStatus: true,
  });
  assert.equal(auto.usedAutoLabel, true);
  assert.equal(auto.rows.length, 16);
  assert.ok(auto.classCounts.OFF > 0);
  assert.ok(auto.classCounts.IDLE > 0);
  assert.ok(auto.classCounts.WORKING > 0);
});

test("parseCsvText and normalizeMachineStatusLabel handle quoted commas and aliases", () => {
  const mat = parseCsvText('a,b\n"1,234","hello ""world"""');
  assert.deepEqual(mat, [
    ["a", "b"],
    ["1,234", 'hello "world"'],
  ]);
  assert.equal(normalizeMachineStatusLabel("start-up"), "START_UP");
  assert.equal(normalizeMachineStatusLabel("standby"), "IDLE");
  assert.equal(normalizeMachineStatusLabel("produksi"), "WORKING");
  assert.equal(normalizeMachineStatusLabel("invalid"), null);
});
