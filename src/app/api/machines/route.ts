import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyEnergyPortfolioQuadrant } from "@/lib/audit/portfolio";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const session = await getCurrentSession();

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
