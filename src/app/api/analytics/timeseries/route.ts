import { NextResponse } from "next/server";
import {
  buildEnergyTimeseriesFromSessions,
  type TimeseriesGranularity,
} from "@/lib/audit/timeseries";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

const LOOKBACK_DAYS: Record<TimeseriesGranularity, number> = {
  daily: 30,
  weekly: 60,
  monthly: 370,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawGranularity = searchParams.get("granularity") ?? "daily";
  const granularity: TimeseriesGranularity =
    rawGranularity === "weekly" || rawGranularity === "monthly"
      ? rawGranularity
      : "daily";
  const machineCode = (searchParams.get("machineCode") ?? "ALL").trim();

  const session = await getCurrentSession();
  const now = new Date();
  const since = new Date(
    now.getTime() - LOOKBACK_DAYS[granularity] * 86_400_000
  );

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({
        dataSource: "demo",
        granularity,
        machineCode,
        tariffIdrPerKwh: 1444.7,
        series: [],
      });
    }

    const tariffIdrPerKwh = Number(workshop.tariffIdrPerKwh);
    const sessions = await db.machineStateSession.findMany({
      where: {
        startedAt: { gte: since },
        machine: {
          workshopId: workshop.id,
          ...(machineCode && machineCode !== "ALL"
            ? { code: machineCode.toUpperCase() }
            : {}),
        },
      },
      select: {
        startedAt: true,
        status: true,
        energyKwh: true,
      },
      orderBy: { startedAt: "asc" },
    });

    const series = buildEnergyTimeseriesFromSessions({
      sessions,
      granularity,
      tariffIdrPerKwh,
      now,
    });

    const totalCurrentKwh = Number(
      series.reduce((sum, p) => sum + p.currentKwh, 0).toFixed(1)
    );
    const hasPreviousData = series.some((p) => p.previousKwh > 0);

    return NextResponse.json({
      dataSource: "database",
      granularity,
      machineCode,
      tariffIdrPerKwh,
      totalCurrentKwh,
      hasPreviousData,
      series,
    });
  } catch {
    return NextResponse.json({
      dataSource: "demo",
      granularity,
      machineCode,
      tariffIdrPerKwh: 1444.7,
      series: [],
    });
  }
}
