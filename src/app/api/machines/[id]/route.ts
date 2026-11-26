import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const updateMachineSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  ratedPowerW: z.number().min(100).max(100_000).optional(),
  annualOperatingHours: z.number().min(10).max(8760).optional(),
  portfolioQuadrant: z
    .enum(["CRITICAL", "LEVERAGE_POWER", "LEVERAGE_TIME", "NONCRITICAL"])
    .optional(),
  hasPhysicalSensor: z.boolean().optional(),
  idleAlertThresholdMin: z.number().int().min(1).max(240).optional(),
  baselineIdleW: z.number().min(0).max(100_000).optional(),
  baselineWorkingW: z.number().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const rawBody = await request.json().catch(() => null);
  const parsed = updateMachineSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Data pembaruan mesin tidak valid.",
      },
      { status: 400 }
    );
  }

  try {
    const updated = await db.machine.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({
      ok: true,
      persisted: true,
      machine: updated,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      persisted: false,
      machine: { id, ...parsed.data },
    });
  }
}
