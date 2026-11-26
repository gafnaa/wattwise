import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import type { DateRangeKey } from "@/lib/mock-dashboard-data";

const VALID_RANGES: readonly DateRangeKey[] = ["month", "week", "today"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get("range") ?? "month";
  const range: DateRangeKey = VALID_RANGES.includes(rawRange as DateRangeKey)
    ? (rawRange as DateRangeKey)
    : "month";

  const session = await getCurrentSession();
  const overview = await getDashboardOverview(range, session?.workshopId);

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

  const rows = overview.machines.map((m) => [
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
      "Content-Disposition": `attachment; filename="wattwise-audit-${range}.csv"`,
    },
  });
}
