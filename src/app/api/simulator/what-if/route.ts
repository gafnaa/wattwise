import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateWhatIfProjection } from "@/lib/audit/calculator";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";

const whatIfSchema = z.object({
  idleReductionMinPerDay: z.number().min(0).max(240),
  startupReductionPct: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = whatIfSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parameter simulasi What-If tidak valid." },
      { status: 400 }
    );
  }

  const session = await getCurrentSession();
  const overview = await getDashboardOverview("month", session?.workshopId);

  const avgTotalIdlePowerKw = overview.machines.reduce(
    (sum, m) => sum + m.baselineIdleW / 1000,
    0
  );
  const monthlyStartupCount = overview.machines.reduce(
    (sum, m) => sum + m.startupCountMonth,
    0
  );

  const projection = calculateWhatIfProjection({
    idleReductionMinPerDay: parsed.data.idleReductionMinPerDay,
    startupReductionPct: parsed.data.startupReductionPct,
    avgTotalIdlePowerKw,
    monthlyStartupCount,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
    tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
  });

  return NextResponse.json({
    ok: true,
    dataSource: overview.dataSource,
    workshopName: overview.workshop.name,
    projection,
  });
}
