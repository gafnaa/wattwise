import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyEnergyPortfolioQuadrant } from "@/lib/audit/portfolio";
import { getCurrentSession, requireApiAuth } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status")?.toUpperCase();
  const quadrantFilter = searchParams.get("quadrant")?.toUpperCase();
  const query = searchParams.get("q")?.trim().toLowerCase();

  const session = await getCurrentSession();
  const overview = await getDashboardOverview("today", session?.workshopId);

  const machines = overview.machines.filter((m) => {
    const okStatus = !statusFilter || statusFilter === "ALL" || m.status === statusFilter;
    const okQuadrant =
      !quadrantFilter ||
      quadrantFilter === "ALL" ||
      m.portfolioQuadrant === quadrantFilter;
    const okQuery =
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.code.toLowerCase().includes(query);
    return okStatus && okQuadrant && okQuery;
  });

  return NextResponse.json({
    dataSource: overview.dataSource,
    count: machines.length,
    virtualSensor: overview.virtualSensor,
    machines,
  });
}

const createMachineSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  machineType: z.enum([
    "CNC",
    "EDGE_BANDER",
    "PANEL_SAW",
    "DUST_COLLECTOR",
    "BORING",
    "COMPRESSOR",
    "VIRTUAL_AGGREGATE",
    "OTHER",
  ]),
  ratedPowerW: z.number().min(100).max(100_000),
  annualOperatingHours: z.number().min(10).max(8760),
  portfolioQuadrant: z
    .enum(["CRITICAL", "LEVERAGE_POWER", "LEVERAGE_TIME", "NONCRITICAL"])
    .optional(),
  hasPhysicalSensor: z.boolean().optional(),
  idleAlertThresholdMin: z.number().int().min(1).max(240).default(15),
  baselineIdleW: z.number().min(0).max(100_000).optional(),
  baselineWorkingW: z.number().min(0).max(100_000).optional(),
});

export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth({
    roles: ["OWNER", "ADMIN"],
  });
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const parsed = createMachineSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Data mesin tidak valid.",
      },
      { status: 400 }
    );
  }

  const autoPortfolio = classifyEnergyPortfolioQuadrant({
    ratedPowerW: parsed.data.ratedPowerW,
    annualOperatingHours: parsed.data.annualOperatingHours,
  });

  const quadrant = parsed.data.portfolioQuadrant ?? autoPortfolio.quadrant;
  const hasPhysicalSensor =
    parsed.data.hasPhysicalSensor ?? autoPortfolio.recommendedPhysicalSensor;
  const baselineIdleW =
    parsed.data.baselineIdleW ?? Math.round(parsed.data.ratedPowerW * 0.32);
  const baselineWorkingW =
    parsed.data.baselineWorkingW ?? Math.round(parsed.data.ratedPowerW * 0.8);

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        machine: {
          id: `demo-${Date.now()}`,
          ...parsed.data,
          portfolioQuadrant: quadrant,
          hasPhysicalSensor,
          baselineIdleW,
          baselineWorkingW,
          isActive: true,
          deviceUid: null,
        },
      });
    }

    const created = await db.machine.create({
      data: {
        workshopId: workshop.id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        machineType: parsed.data.machineType,
        ratedPowerW: parsed.data.ratedPowerW,
        annualOperatingHours: parsed.data.annualOperatingHours,
        portfolioQuadrant: quadrant,
        hasPhysicalSensor,
        idleAlertThresholdMin: parsed.data.idleAlertThresholdMin,
        baselineIdleW,
        baselineWorkingW,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        persisted: true,
        machine: {
          ...created,
          deviceUid: null,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({
      ok: true,
      persisted: false,
      machine: {
        id: `demo-${Date.now()}`,
        ...parsed.data,
        code: parsed.data.code.toUpperCase(),
        portfolioQuadrant: quadrant,
        hasPhysicalSensor,
        baselineIdleW,
        baselineWorkingW,
        isActive: true,
        deviceUid: null,
      },
    });
  }
}
