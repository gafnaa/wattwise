import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { DashboardOverviewResponse } from "@/lib/dashboard/service";
import {
  calculateWhatIfSavings,
  formatRupiah,
  type DateRangeKey,
} from "@/lib/mock-dashboard-data";

export interface AuditPdfSecSummary {
  totalOutputUnits: number;
  secKwhPerUnit: number | null;
}

export interface AuditPdfInput {
  overview: DashboardOverviewResponse;
  range: DateRangeKey;
  scope: string; // "ALL" atau machine code
  secSummary?: AuditPdfSecSummary | null;
  generatedAt?: Date;
}

const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: "Hari Ini",
  week: "7 Hari Terakhir",
  month: "30 Hari Terakhir",
};

/**
 * StandardFonts (WinAnsi) tidak mendukung karakter di luar Latin-1 (seperti emoji
 * atau em-dash tertentu yang kadang muncul). Normalisasi ke WinAnsi aman.
 */
function sanitizePdfText(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022|\u00B7/g, "-")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safe = sanitizePdfText(text);
  if (!safe) return [];
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatWibTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
  return `${parts} WIB`;
}

/**
 * Menghasilkan file PDF biner (A4, standar ISO 14955-5:2020) langsung di server
 * menggunakan `pdf-lib` tanpa dependensi browser headless.
 */
export async function generateAuditPdfBytes(
  input: AuditPdfInput
): Promise<Uint8Array> {
  const { overview, range, scope, secSummary, generatedAt = new Date() } = input;
  const scopeUpper = scope.trim().toUpperCase();
  const filteredMachines =
    scopeUpper === "ALL"
      ? overview.machines
      : overview.machines.filter((m) => m.code.toUpperCase() === scopeUpper);
  const machines =
    filteredMachines.length > 0 ? filteredMachines : overview.machines;

  const isSingleMachine = scopeUpper !== "ALL" && filteredMachines.length === 1;
  const scopeLabel = isSingleMachine
    ? `${machines[0].name} (${machines[0].code})`
    : `Seluruh Mesin Prioritas (${machines.length} unit)`;

  const paretoScale = overview.metrics.paretoScale;
  const tariffIdr = overview.workshop.tariffIdrPerKwh;

  // Hitung metrik untuk cakupan yang dipilih
  const machineRows = machines
    .map((m) => {
      const idleLossIdr = Math.round(m.idleLossMonthIdr * paretoScale);
      const totalKwhEst = Number(
        (
          ((m.workingHoursMonth * m.baselineWorkingW +
            m.idleHoursMonth * m.baselineIdleW) /
            1000) *
          paretoScale
        ).toFixed(1)
      );
      const totalCostIdr = Math.round(totalKwhEst * tariffIdr);
      return {
        ...m,
        idleLossIdr,
        totalKwhEst,
        totalCostIdr,
      };
    })
    .sort((a, b) => b.idleLossIdr - a.idleLossIdr);

  const totalEnergyKwh = isSingleMachine
    ? machineRows[0].totalKwhEst
    : overview.metrics.totalEnergyKwh;
  const totalCostIdr = isSingleMachine
    ? machineRows[0].totalCostIdr
    : overview.metrics.totalEnergyCostIdr;
  const totalIdleLossIdr = isSingleMachine
    ? machineRows[0].idleLossIdr
    : overview.metrics.idleLossIdr;
  const idleSharePct =
    totalCostIdr > 0
      ? Number(((totalIdleLossIdr / totalCostIdr) * 100).toFixed(1))
      : 0;
  const efficiencyPct = overview.metrics.operationalEfficiencyPct;

  const whatIf30 = calculateWhatIfSavings({
    idleReductionMinPerDay: 30,
    startupReductionPct: 35,
    machines,
    tariffIdrPerKwh: tariffIdr,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(
    sanitizePdfText(`Laporan Audit Energi WattWise - ${overview.workshop.name}`)
  );
  pdfDoc.setAuthor("WattWise Energy Intelligence");
  pdfDoc.setSubject("Audit Energi Standar ISO 14955-5:2020");
  pdfDoc.setCreationDate(generatedAt);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palet warna WattWise (Emerald + Slate Netral)
  const C_EMERALD = rgb(5 / 255, 150 / 255, 105 / 255); // #059669
  const C_EMERALD_DARK = rgb(6 / 255, 95 / 255, 70 / 255); // #065F46
  const C_EMERALD_SOFT = rgb(236 / 255, 253 / 255, 245 / 255); // #ECFDF5
  const C_AMBER = rgb(217 / 255, 119 / 255, 6 / 255); // #D97706
  const C_BLUE = rgb(37 / 255, 99 / 255, 235 / 255); // #2563EB
  const C_SLATE_900 = rgb(24 / 255, 24 / 255, 27 / 255); // #18181B
  const C_SLATE_600 = rgb(82 / 255, 82 / 255, 91 / 255); // #52525B
  const C_SLATE_400 = rgb(161 / 255, 161 / 255, 170 / 255); // #A1A1AA
  const C_BORDER = rgb(228 / 255, 228 / 255, 231 / 255); // #E4E4E7
  const C_BG_SOFT = rgb(250 / 255, 250 / 255, 250 / 255); // #FAFAFA
  const C_WHITE = rgb(1, 1, 1);

  // Ukuran A4 (595.28 x 841.89 pt)
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (neededPt: number) => {
    if (y - neededPt < MARGIN + 30) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = PAGE_H - MARGIN;
    }
  };

  // =========================================================================
  // 1. HEADER BANNER
  // =========================================================================
  const headerH = 84;
  page.drawRectangle({
    x: MARGIN,
    y: y - headerH,
    width: CONTENT_W,
    height: headerH,
    color: C_EMERALD_DARK,
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - headerH,
    width: 6,
    height: headerH,
    color: C_EMERALD,
  });

  page.drawText("WATTWISE ENERGY INTELLIGENCE", {
    x: MARGIN + 18,
    y: y - 22,
    size: 8.5,
    font: fontBold,
    color: rgb(167 / 255, 243 / 255, 208 / 255),
  });

  page.drawText(
    sanitizePdfText(`Laporan Audit Energi - ${RANGE_LABELS[range]}`),
    {
      x: MARGIN + 18,
      y: y - 42,
      size: 16,
      font: fontBold,
      color: C_WHITE,
    }
  );

  page.drawText(
    sanitizePdfText(
      `${overview.workshop.name} (${overview.workshop.location})  |  Cakupan: ${scopeLabel}`
    ),
    {
      x: MARGIN + 18,
      y: y - 59,
      size: 9,
      font: fontRegular,
      color: rgb(228 / 255, 246 / 255, 238 / 255),
    }
  );

  page.drawText(
    sanitizePdfText(
      `Standar: ISO 14955-5:2020  |  Tarif PLN: Rp ${tariffIdr.toLocaleString("id-ID")}/kWh  |  Dicetak: ${formatWibTimestamp(generatedAt)}`
    ),
    {
      x: MARGIN + 18,
      y: y - 73,
      size: 8,
      font: fontRegular,
      color: rgb(167 / 255, 243 / 255, 208 / 255),
    }
  );

  y -= headerH + 18;

  // =========================================================================
  // 2. RINGKASAN KPI (4 KOTAK SEJAJAR)
  // =========================================================================
  const kpiGap = 10;
  const kpiW = (CONTENT_W - kpiGap * 3) / 4;
  const kpiH = 62;

  const kpiCards = [
    {
      label: "Total Energi",
      value: `${totalEnergyKwh.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kWh`,
      sub: `Periode ${RANGE_LABELS[range]}`,
      accent: C_EMERALD,
    },
    {
      label: "Estimasi Biaya",
      value: formatRupiah(totalCostIdr),
      sub: `Tarif Rp ${tariffIdr.toLocaleString("id-ID")}/kWh`,
      accent: C_SLATE_900,
    },
    {
      label: "Kerugian Idle",
      value: formatRupiah(totalIdleLossIdr),
      sub: `${idleSharePct}% dari biaya listrik`,
      accent: C_AMBER,
    },
    {
      label: "Efisiensi ISO 14955-5",
      value: `${efficiencyPct}%`,
      sub:
        secSummary && secSummary.secKwhPerUnit !== null
          ? `SEC ${secSummary.secKwhPerUnit.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kWh/unit`
          : efficiencyPct >= 75
            ? "Kategori: Sangat Baik"
            : efficiencyPct >= 60
              ? "Kategori: Baik"
              : "Perlu Optimasi",
      accent: C_EMERALD_DARK,
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = MARGIN + idx * (kpiW + kpiGap);
    page.drawRectangle({
      x,
      y: y - kpiH,
      width: kpiW,
      height: kpiH,
      color: C_BG_SOFT,
      borderColor: C_BORDER,
      borderWidth: 0.75,
    });
    page.drawRectangle({
      x,
      y: y - 3,
      width: kpiW,
      height: 3,
      color: card.accent,
    });

    page.drawText(sanitizePdfText(card.label), {
      x: x + 9,
      y: y - 18,
      size: 7.5,
      font: fontBold,
      color: C_SLATE_600,
    });
    page.drawText(sanitizePdfText(card.value), {
      x: x + 9,
      y: y - 37,
      size: 11.5,
      font: fontBold,
      color: C_SLATE_900,
    });
    page.drawText(sanitizePdfText(card.sub), {
      x: x + 9,
      y: y - 52,
      size: 7.2,
      font: fontRegular,
      color: C_SLATE_600,
    });
  });

  y -= kpiH + 18;

  // =========================================================================
  // 3. DISTRIBUSI STATUS OPERASIONAL ISO 14955-5
  // =========================================================================
  page.drawText("Distribusi Waktu Operasional Mesin (ISO 14955-5)", {
    x: MARGIN,
    y,
    size: 10.5,
    font: fontBold,
    color: C_SLATE_900,
  });
  y -= 14;

  const workingPct =
    overview.metrics.isoDistribution.find((d) => d.key === "working")?.pct ?? 0;
  const idlePct =
    overview.metrics.isoDistribution.find((d) => d.key === "idle")?.pct ?? 0;
  const startupPct =
    overview.metrics.isoDistribution.find((d) => d.key === "startup")?.pct ?? 0;
  const offPct = Math.max(0, 100 - workingPct - idlePct - startupPct);

  const isoSegments = [
    { label: "Working", pct: workingPct, color: C_EMERALD },
    { label: "Idle", pct: idlePct, color: C_AMBER },
    { label: "Start-up", pct: startupPct, color: C_BLUE },
    { label: "Off", pct: offPct, color: C_SLATE_400 },
  ];

  const barH = 11;
  let barX = MARGIN;
  for (const seg of isoSegments) {
    const segW = (CONTENT_W * seg.pct) / 100;
    if (segW > 0.5) {
      page.drawRectangle({
        x: barX,
        y: y - barH,
        width: segW,
        height: barH,
        color: seg.color,
      });
      barX += segW;
    }
  }

  y -= barH + 12;
  let legendX = MARGIN;
  for (const seg of isoSegments) {
    page.drawRectangle({
      x: legendX,
      y: y + 1,
      width: 7,
      height: 7,
      color: seg.color,
    });
    const txt = `${seg.label}: ${seg.pct}%`;
    page.drawText(txt, {
      x: legendX + 11,
      y: y + 1,
      size: 8,
      font: fontRegular,
      color: C_SLATE_600,
    });
    legendX += fontRegular.widthOfTextAtSize(txt, 8) + 28;
  }

  y -= 20;

  // =========================================================================
  // 4. TABEL AUDIT PER MESIN & PARETO KERUGIAN IDLE
  // =========================================================================
  page.drawText("Rincian Audit per Mesin & Peringkat Pareto Kerugian Idle", {
    x: MARGIN,
    y,
    size: 10.5,
    font: fontBold,
    color: C_SLATE_900,
  });
  y -= 14;

  const cols = [
    { title: "Mesin", x: MARGIN + 6, w: 145, align: "left" as const },
    { title: "Status", x: MARGIN + 155, w: 58, align: "left" as const },
    { title: "Daya (W)", x: MARGIN + 215, w: 68, align: "right" as const },
    { title: "PF", x: MARGIN + 288, w: 32, align: "right" as const },
    { title: "Konsumsi", x: MARGIN + 325, w: 66, align: "right" as const },
    { title: "Est. Rugi Idle", x: MARGIN + 396, w: 112, align: "right" as const },
  ];

  // Header baris tabel
  const rowH = 22;
  page.drawRectangle({
    x: MARGIN,
    y: y - rowH,
    width: CONTENT_W,
    height: rowH,
    color: C_EMERALD_SOFT,
    borderColor: C_BORDER,
    borderWidth: 0.5,
  });

  for (const col of cols) {
    const label = sanitizePdfText(col.title);
    const tx =
      col.align === "right"
        ? col.x + col.w - fontBold.widthOfTextAtSize(label, 8)
        : col.x;
    page.drawText(label, {
      x: tx,
      y: y - 14,
      size: 8,
      font: fontBold,
      color: C_EMERALD_DARK,
    });
  }
  y -= rowH;

  const maxIdleLoss = Math.max(1, ...machineRows.map((m) => m.idleLossIdr));

  for (let i = 0; i < machineRows.length; i++) {
    ensureSpace(30);
    const m = machineRows[i];
    const rH = 26;
    if (i % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rH,
        width: CONTENT_W,
        height: rH,
        color: C_BG_SOFT,
      });
    }
    page.drawLine({
      start: { x: MARGIN, y: y - rH },
      end: { x: MARGIN + CONTENT_W, y: y - rH },
      thickness: 0.4,
      color: C_BORDER,
    });

    // Kolom 1: Nama & Kode
    page.drawText(sanitizePdfText(m.name).slice(0, 26), {
      x: cols[0].x,
      y: y - 11,
      size: 8.3,
      font: fontBold,
      color: C_SLATE_900,
    });
    page.drawText(
      sanitizePdfText(`${m.code} - ${m.portfolioQuadrant.replace("_", " ")}`),
      {
        x: cols[0].x,
        y: y - 21,
        size: 6.8,
        font: fontRegular,
        color: C_SLATE_600,
      }
    );

    // Kolom 2: Status
    const statusColor =
      m.status === "WORKING"
        ? C_EMERALD
        : m.status === "IDLE"
          ? C_AMBER
          : m.status === "START_UP"
            ? C_BLUE
            : C_SLATE_600;
    page.drawText(sanitizePdfText(m.status), {
      x: cols[1].x,
      y: y - 15,
      size: 7.8,
      font: fontBold,
      color: statusColor,
    });

    // Kolom 3: Daya Aktual / Rated
    const pwrStr = `${m.currentPowerW.toLocaleString("id-ID")} / ${m.ratedPowerW.toLocaleString("id-ID")}`;
    page.drawText(pwrStr, {
      x: cols[2].x + cols[2].w - fontRegular.widthOfTextAtSize(pwrStr, 7.6),
      y: y - 15,
      size: 7.6,
      font: fontRegular,
      color: C_SLATE_900,
    });

    // Kolom 4: PF
    const pfStr = m.powerFactor.toFixed(2);
    page.drawText(pfStr, {
      x: cols[3].x + cols[3].w - fontRegular.widthOfTextAtSize(pfStr, 7.6),
      y: y - 15,
      size: 7.6,
      font: fontRegular,
      color: C_SLATE_600,
    });

    // Kolom 5: Konsumsi kWh
    const kwhStr = `${m.totalKwhEst.toLocaleString("id-ID")} kWh`;
    page.drawText(kwhStr, {
      x: cols[4].x + cols[4].w - fontRegular.widthOfTextAtSize(kwhStr, 7.8),
      y: y - 15,
      size: 7.8,
      font: fontRegular,
      color: C_SLATE_900,
    });

    // Kolom 6: Est. Rugi Idle + Mini Pareto Bar
    const lossStr = formatRupiah(m.idleLossIdr);
    page.drawText(lossStr, {
      x: cols[5].x + cols[5].w - fontBold.widthOfTextAtSize(lossStr, 8),
      y: y - 11,
      size: 8,
      font: fontBold,
      color: m.idleLossIdr > 0 ? C_AMBER : C_SLATE_600,
    });
    const barTrackW = 72;
    const barFillW = Math.max(2, (m.idleLossIdr / maxIdleLoss) * barTrackW);
    page.drawRectangle({
      x: cols[5].x + cols[5].w - barTrackW,
      y: y - 21,
      width: barTrackW,
      height: 4,
      color: C_BORDER,
    });
    page.drawRectangle({
      x: cols[5].x + cols[5].w - barTrackW,
      y: y - 21,
      width: barFillW,
      height: 4,
      color: C_AMBER,
    });

    y -= rH;
  }

  y -= 18;

  // =========================================================================
  // 5. PROYEKSI PENGHEMATAN WHAT-IF & REKOMENDASI AI ADVISOR
  // =========================================================================
  ensureSpace(90);
  const whatIfH = 48;
  page.drawRectangle({
    x: MARGIN,
    y: y - whatIfH,
    width: CONTENT_W,
    height: whatIfH,
    color: C_EMERALD_SOFT,
    borderColor: C_EMERALD,
    borderWidth: 0.75,
  });
  page.drawText("Proyeksi Penghematan What-If (Pengurangan Idle 30 menit/hari)", {
    x: MARGIN + 12,
    y: y - 17,
    size: 9,
    font: fontBold,
    color: C_EMERALD_DARK,
  });
  page.drawText(
    sanitizePdfText(
      `Estimasi penghematan bulanan: ${formatRupiah(whatIf30.totalSavingIdr)}/bulan (${whatIf30.totalSavedKwh.toLocaleString("id-ID")} kWh/bulan untuk ${overview.workshop.workingDaysPerMonth} hari kerja).`
    ),
    {
      x: MARGIN + 12,
      y: y - 34,
      size: 8.5,
      font: fontRegular,
      color: C_SLATE_900,
    }
  );
  y -= whatIfH + 18;

  const relevantRecs = overview.actionLogs
    .filter(
      (a) =>
        scopeUpper === "ALL" || a.machineCode.toUpperCase() === scopeUpper
    )
    .slice(0, 4);

  if (relevantRecs.length > 0) {
    ensureSpace(60);
    page.drawText("Rekomendasi Tindakan Prioritas (AI Advisor)", {
      x: MARGIN,
      y,
      size: 10.5,
      font: fontBold,
      color: C_SLATE_900,
    });
    y -= 14;

    for (const rec of relevantRecs) {
      const wrapped = wrapText(
        rec.recommendation,
        fontRegular,
        8.2,
        CONTENT_W - 24
      );
      const boxH = 22 + wrapped.length * 11;
      ensureSpace(boxH + 8);

      page.drawRectangle({
        x: MARGIN,
        y: y - boxH,
        width: CONTENT_W,
        height: boxH,
        color: C_BG_SOFT,
        borderColor: C_BORDER,
        borderWidth: 0.6,
      });

      const titleLine = sanitizePdfText(
        `${rec.machineName} (${rec.machineCode})  -  Status: ${rec.status}`
      );
      page.drawText(titleLine, {
        x: MARGIN + 10,
        y: y - 13,
        size: 8.3,
        font: fontBold,
        color: C_SLATE_900,
      });

      const saveStr = `Est. hemat ${formatRupiah(rec.estimatedSavingIdr)}/bln`;
      page.drawText(saveStr, {
        x:
          MARGIN +
          CONTENT_W -
          10 -
          fontBold.widthOfTextAtSize(saveStr, 8),
        y: y - 13,
        size: 8,
        font: fontBold,
        color: C_EMERALD_DARK,
      });

      let lineY = y - 25;
      for (const line of wrapped) {
        page.drawText(line, {
          x: MARGIN + 10,
          y: lineY,
          size: 8.2,
          font: fontRegular,
          color: C_SLATE_600,
        });
        lineY -= 11;
      }

      y -= boxH + 8;
    }
  }

  // =========================================================================
  // 6. FOOTER PADA SETIAP HALAMAN
  // =========================================================================
  pages.forEach((pg, idx) => {
    pg.drawLine({
      start: { x: MARGIN, y: MARGIN + 16 },
      end: { x: PAGE_W - MARGIN, y: MARGIN + 16 },
      thickness: 0.5,
      color: C_BORDER,
    });
    pg.drawText(
      "WattWise Smart Energy Audit - Laporan dihasilkan otomatis dari data sensor & klasifikasi Random Forest ISO 14955-5",
      {
        x: MARGIN,
        y: MARGIN + 5,
        size: 7,
        font: fontRegular,
        color: C_SLATE_600,
      }
    );
    const pageNum = `Halaman ${idx + 1} / ${pages.length}`;
    pg.drawText(pageNum, {
      x: PAGE_W - MARGIN - fontRegular.widthOfTextAtSize(pageNum, 7),
      y: MARGIN + 5,
      size: 7,
      font: fontRegular,
      color: C_SLATE_600,
    });
  });

  return pdfDoc.save();
}
