import { extractFeatures } from "./features";
import {
  MACHINE_STATUS_CLASSES,
  type MachineStatus,
  type PowerSample,
} from "./types";

export interface SpreadsheetLabeledFeatureRow {
  features: number[];
  labelIdx: number;
  machineCode: string;
}

export interface ParsedSpreadsheetDataset {
  rows: SpreadsheetLabeledFeatureRow[];
  rawRowCount: number;
  skippedRowCount: number;
  machineCodes: string[];
  classCounts: Record<MachineStatus, number>;
  usedAutoLabel: boolean;
  detectedHeaders: string[];
}

export interface SpreadsheetParseOptions {
  defaultRatedPowerW?: number;
  defaultMachineCode?: string;
  autoLabelIfMissingStatus?: boolean;
}

/**
 * Mengonversi berbagai format link Google Sheets (atau URL CSV langsung)
 * menjadi URL unduhan CSV yang bisa di-fetch langsung tanpa OAuth.
 *
 * Contoh yang didukung:
 * - https://docs.google.com/spreadsheets/d/<ID>/edit#gid=12345
 * - https://docs.google.com/spreadsheets/d/<ID>/edit?gid=12345&usp=sharing
 * - https://docs.google.com/spreadsheets/d/<ID>/edit?usp=sharing (dengan/tanpa sheetName)
 * - https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml
 * - https://example.com/dataset.csv
 */
export function resolveSpreadsheetCsvUrl(
  inputUrl: string,
  options?: { gid?: string; sheetName?: string }
): string {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error("URL spreadsheet tidak boleh kosong.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`URL spreadsheet tidak valid: "${trimmed}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL spreadsheet harus menggunakan protokol http:// atau https://.");
  }

  if (parsed.hostname === "docs.google.com" && parsed.pathname.includes("/spreadsheets/")) {
    // Kasus 1: Link "Publish to web" (/spreadsheets/d/e/2PACX-.../pubhtml atau /pub)
    const pubMatch = parsed.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)/);
    if (pubMatch) {
      const pubId = pubMatch[1];
      const gid = options?.gid ?? parsed.searchParams.get("gid") ?? extractHashGid(parsed.hash);
      const out = new URL(
        `https://docs.google.com/spreadsheets/d/e/${pubId}/pub`
      );
      if (gid) out.searchParams.set("gid", gid);
      out.searchParams.set("single", "true");
      out.searchParams.set("output", "csv");
      return out.toString();
    }

    // Kasus 2: Link standar Google Sheets (/spreadsheets/d/<SHEET_ID>/...)
    const stdMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (stdMatch) {
      const sheetId = stdMatch[1];

      // Jika pengguna memilih tab lewat nama sheet (bukan gid), gunakan endpoint gviz CSV
      if (options?.sheetName?.trim()) {
        const gviz = new URL(
          `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`
        );
        gviz.searchParams.set("tqx", "out:csv");
        gviz.searchParams.set("sheet", options.sheetName.trim());
        return gviz.toString();
      }

      const gid =
        options?.gid?.trim() ||
        parsed.searchParams.get("gid") ||
        extractHashGid(parsed.hash);

      const exportUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${sheetId}/export`
      );
      exportUrl.searchParams.set("format", "csv");
      if (gid) {
        exportUrl.searchParams.set("gid", gid);
      }
      return exportUrl.toString();
    }
  }

  // Kasus 3: Sudah berupa URL CSV langsung
  return parsed.toString();
}

function extractHashGid(hash: string): string | null {
  if (!hash) return null;
  const match = hash.match(/gid=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Parser CSV sesuai RFC 4180 (mendukung BOM UTF-8, CRLF/LF, tanda kutip ganda,
 * koma di dalam sel, dan kutip ter-escape `""`).
 */
export function parseCsvText(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function findColumnIndex(headers: string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Mengurai angka daya yang bisa ditulis dengan titik atau koma desimal
 * (mis. "3450.5", "3450,5", "3.450,5").
 */
function parseFlexibleNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/\s+/g, "");
  if (!cleaned) return null;

  // Format Indonesia: "3.450,5" -> "3450.5"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseFlexibleTimestampMs(
  raw: string | undefined,
  fallbackMs: number
): number {
  if (!raw || !raw.trim()) return fallbackMs;
  const trimmed = raw.trim();

  // Unix epoch numerik (detik atau milidetik)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      return num < 1e12 ? Math.round(num * 1000) : Math.round(num);
    }
  }

  // Format umum spreadsheet: "YYYY-MM-DD HH:mm:ss" -> ISO
  const isoCandidate = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(" ", "T")
    : trimmed;
  const parsed = Date.parse(isoCandidate);
  if (!Number.isNaN(parsed)) return parsed;

  // Format DD/MM/YYYY HH:mm:ss (umum di Google Sheets lokal ID)
  const dmyMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = dmyMatch;
    const d = Date.parse(
      `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:${ss}Z`
    );
    if (!Number.isNaN(d)) return d;
  }

  return fallbackMs;
}

export function normalizeMachineStatusLabel(
  raw: string | undefined
): MachineStatus | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (key === "OFF" || key === "MATI" || key === "0") return "OFF";
  if (
    key === "START_UP" ||
    key === "STARTUP" ||
    key === "START" ||
    key === "INRUSH" ||
    key === "1"
  ) {
    return "START_UP";
  }
  if (
    key === "IDLE" ||
    key === "SIAGA" ||
    key === "STANDBY" ||
    key === "TANPA_BEBAN" ||
    key === "2"
  ) {
    return "IDLE";
  }
  if (
    key === "WORKING" ||
    key === "WORK" ||
    key === "BEKERJA" ||
    key === "AKTIF" ||
    key === "PRODUKSI" ||
    key === "3"
  ) {
    return "WORKING";
  }

  return null;
}

/**
 * Weak-supervision fallback ISO 14955-5 jika dataset 3-kolom dari hardware
 * belum memiliki kolom `status` dan pengguna mengaktifkan `--auto-label`.
 */
function inferWeakIsoLabel(
  powerRatio: number,
  prevPowerRatio: number,
  rollingStdRatio: number
): MachineStatus {
  if (powerRatio < 0.05) return "OFF";
  if (powerRatio >= 0.92 || (prevPowerRatio < 0.08 && powerRatio >= 0.55)) {
    return "START_UP";
  }
  if (powerRatio >= 0.52 || rollingStdRatio >= 0.04) {
    return "WORKING";
  }
  return "IDLE";
}

/**
 * Mengurai teks CSV dari Google Sheets menjadi baris fitur 7-dimensi siap latih
 * yang 100% konsisten dengan `extractFeatures()` di runtime Next.js.
 */
export function parseSpreadsheetDatasetCsv(
  csvText: string,
  options?: SpreadsheetParseOptions
): ParsedSpreadsheetDataset {
  const trimmed = csvText.trimStart();
  if (
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<title>Sign in") ||
    trimmed.includes("accounts.google.com")
  ) {
    throw new Error(
      "Spreadsheet tidak dapat diakses publik (Google mengembalikan halaman HTML/login). Pastikan akses Google Sheets disetel ke 'Anyone with the link (Viewer)' atau 'Publish to web'."
    );
  }

  const matrix = parseCsvText(csvText);
  if (matrix.length < 4) {
    throw new Error(
      `Dataset CSV terlalu sedikit (${matrix.length} baris termasuk header). Minimal butuh beberapa sampel untuk membentuk sliding-window.`
    );
  }

  const rawHeaders = matrix[0];
  const headers = rawHeaders.map(normalizeHeader);

  const tsIdx = findColumnIndex(headers, [
    "timestamp",
    "recorded_at",
    "waktu",
    "time",
    "datetime",
    "tanggal",
  ]);
  const powerIdx = findColumnIndex(headers, [
    "daya",
    "power_w",
    "power",
    "watt",
    "daya_w",
    "daya_aktif",
    "active_power",
  ]);
  const statusIdx = findColumnIndex(headers, [
    "status",
    "label",
    "state",
    "kelas",
    "class",
    "machine_status",
  ]);
  const sampleIdxCol = findColumnIndex(headers, [
    "index",
    "sample_index",
    "no",
    "id",
  ]);
  const machineCol = findColumnIndex(headers, [
    "machine_code",
    "machine",
    "mesin",
    "kode_mesin",
    "device_uid",
  ]);
  const ratedCol = findColumnIndex(headers, [
    "rated_power_w",
    "rated_w",
    "kapasitas_w",
    "kapasitas",
  ]);

  if (powerIdx === -1) {
    throw new Error(
      `Kolom daya tidak ditemukan. Header terdeteksi: [${rawHeaders.join(", ")}]. Gunakan salah satu nama kolom: daya, power_w, power, atau watt.`
    );
  }

  if (statusIdx === -1 && !options?.autoLabelIfMissingStatus) {
    throw new Error(
      `Kolom label 'status' (OFF/START_UP/IDLE/WORKING) tidak ditemukan. Header terdeteksi: [${rawHeaders.join(", ")}]. Tambahkan kolom 'status' di spreadsheet atau jalankan dengan flag --auto-label.`
    );
  }

  const defaultRatedW = Math.max(100, options?.defaultRatedPowerW ?? 3800);
  const defaultMachine = options?.defaultMachineCode?.trim() || "MESIN-01";
  const usedAutoLabel = statusIdx === -1;

  interface RawRecord {
    machineCode: string;
    ratedPowerW: number;
    sampleIndex: number;
    recordedAtMs: number;
    powerW: number;
    status: MachineStatus | null;
  }

  const grouped = new Map<string, RawRecord[]>();
  let skippedRowCount = 0;
  let baseFallbackMs = Date.parse("2026-11-26T08:00:00Z");

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const powerW = parseFlexibleNumber(cells[powerIdx]);
    if (powerW === null || powerW < 0) {
      skippedRowCount++;
      continue;
    }

    const status =
      statusIdx !== -1 ? normalizeMachineStatusLabel(cells[statusIdx]) : null;
    if (statusIdx !== -1 && !status) {
      skippedRowCount++;
      continue;
    }

    const sampleIndex =
      sampleIdxCol !== -1
        ? Math.round(parseFlexibleNumber(cells[sampleIdxCol]) ?? r)
        : r;
    const recordedAtMs =
      tsIdx !== -1
        ? parseFlexibleTimestampMs(cells[tsIdx], baseFallbackMs)
        : baseFallbackMs;
    baseFallbackMs = recordedAtMs + 2000;

    const machineCode =
      machineCol !== -1 && cells[machineCol]
        ? cells[machineCol].trim().toUpperCase()
        : defaultMachine;
    const ratedPowerW = Math.max(
      100,
      (ratedCol !== -1 ? parseFlexibleNumber(cells[ratedCol]) : null) ??
        defaultRatedW
    );

    const list = grouped.get(machineCode) ?? [];
    list.push({
      machineCode,
      ratedPowerW,
      sampleIndex,
      recordedAtMs,
      powerW,
      status,
    });
    grouped.set(machineCode, list);
  }

  const rows: SpreadsheetLabeledFeatureRow[] = [];
  const classCounts: Record<MachineStatus, number> = {
    OFF: 0,
    START_UP: 0,
    IDLE: 0,
    WORKING: 0,
  };

  for (const [machineCode, records] of grouped.entries()) {
    records.sort((a, b) => {
      const dt = a.recordedAtMs - b.recordedAtMs;
      if (dt !== 0) return dt;
      return a.sampleIndex - b.sampleIndex;
    });

    const history: PowerSample[] = [];
    for (const rec of records) {
      history.push({
        sampleIndex: rec.sampleIndex,
        recordedAt: rec.recordedAtMs,
        powerW: rec.powerW,
      });
      if (history.length > 5) history.shift();

      if (history.length >= 3) {
        const extracted = extractFeatures(history, rec.ratedPowerW, 5);
        const finalStatus =
          rec.status ??
          inferWeakIsoLabel(
            extracted.byName.power_ratio,
            extracted.byName.prev_power_ratio,
            extracted.byName.rolling_std_ratio
          );
        const labelIdx = MACHINE_STATUS_CLASSES.indexOf(finalStatus);
        classCounts[finalStatus]++;
        rows.push({
          features: extracted.values,
          labelIdx,
          machineCode,
        });
      }
    }
  }

  if (rows.length < 10) {
    throw new Error(
      `Jumlah sampel fitur valid terlalu sedikit (${rows.length} baris). Pastikan minimal ada 15+ baris data daya yang valid.`
    );
  }

  return {
    rows,
    rawRowCount: matrix.length - 1,
    skippedRowCount,
    machineCodes: Array.from(grouped.keys()),
    classCounts,
    usedAutoLabel,
    detectedHeaders: rawHeaders,
  };
}

/**
 * Mengunduh CSV dari link Google Sheets / URL CSV publik dan mengurainya
 * menjadi dataset fitur siap latih Random Forest.
 */
export async function fetchSpreadsheetDataset(
  sheetUrl: string,
  options?: SpreadsheetParseOptions & { gid?: string; sheetName?: string }
): Promise<ParsedSpreadsheetDataset & { csvUrl: string }> {
  const csvUrl = resolveSpreadsheetCsvUrl(sheetUrl, {
    gid: options?.gid,
    sheetName: options?.sheetName,
  });

  const res = await fetch(csvUrl, {
    redirect: "follow",
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Gagal mengunduh dataset spreadsheet (HTTP ${res.status}). Pastikan link Google Sheets valid dan dibagikan publik ('Anyone with the link — Viewer').`
    );
  }

  const csvText = await res.text();
  const parsed = parseSpreadsheetDatasetCsv(csvText, options);
  return { csvUrl, ...parsed };
}
