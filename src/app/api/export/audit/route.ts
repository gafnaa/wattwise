import { NextResponse } from "next/server";
import { calculateSpecificEnergyConsumption } from "@/lib/audit/calculator";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";
import type { DateRangeKey } from "@/lib/mock-dashboard-data";
import { generateAuditPdfBytes } from "@/lib/reports/pdf-generator";

const VALID_RANGES: readonly DateRangeKey[] = ["month", "week", "today"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get("range") ?? "month";
  const range: DateRangeKey = VALID_RANGES.includes(rawRange as DateRangeKey)
    ? (rawRange as DateRangeKey)
    : "month";

  const rawFormat = (searchParams.get("format") ?? "csv").toLowerCase();
  const format = rawFormat === "pdf" ? "pdf" : "csv";
  const rawScope = (searchParams.get("scope") ?? "ALL").trim().toUpperCase();
  const scope = rawScope.length > 0 ? rawScope : "ALL";
  const disposition =
    searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  const session = await getCurrentSession();
  const overview = await getDashboardOverview(range, session?.workshopId);

  const safeSlug = scope.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  if (format === "pdf") {
    let secSummary: {
      totalOutputUnits: number;
      secKwhPerUnit: number | null;
    } | null = null;

    try {
      if (overview.dataSource === "database") {
        const days = range === "today" ? 1 : range === "week" ? 7 : 30;
        const since = new Date(Date.now() - days * 86_400_000);
        const logs = await db.productionLog.findMany({
          where: {
            workshopId: overview.workshop.id,
            periodDate: { gte: since },
          },
          select: { outputUnits: true },
        });
        const totalOutputUnits = logs.reduce((s, l) => s + l.outputUnits, 0);
        if (totalOutputUnits > 0) {
          secSummary = {
            totalOutputUnits,
            secKwhPerUnit: calculateSpecificEnergyConsumption(
              overview.metrics.totalEnergyKwh,
              totalOutputUnits
            ),
          };
        }
      }
    } catch {
      secSummary = null;
    }

    const pdfBytes = await generateAuditPdfBytes({
      overview,
      range,
      scope,
      secSummary,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="wattwise-audit-${range}-${safeSlug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const filteredMachines =
    scope === "ALL"
      ? overview.machines
      : overview.machines.filter((m) => m.code.toUpperCase() === scope);
  const targetMachines =
    filteredMachines.length > 0 ? filteredMachines : overview.machines;

  const header = [
    "Kode Mesin",
    "Nama Mesin",
    "Status ISO 14955-5",
    "Daya Aktual (W)",
    "Daya Rated (W)",
    "Power Factor",
    "Kuadran Portfolio",
    "Estimasi Rugi Idle (Rp)",
    "Sumber Data",
  ];

  const rows = targetMachines.map((m) => [
    m.code,
    `"${m.name.replace(/"/g, '""')}"`,
    m.status,
    m.currentPowerW,
    m.ratedPowerW,
    m.powerFactor,
    m.portfolioQuadrant,
    Math.round(m.idleLossMonthIdr * overview.metrics.paretoScale),
    overview.dataSource,
  ]);

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="wattwise-audit-${range}-${safeSlug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
