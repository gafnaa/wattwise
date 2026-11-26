import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateSpecificEnergyConsumption } from "@/lib/audit/calculator";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERIOD_METRICS } from "@/lib/mock-dashboard-data";

const createProductionLogSchema = z.object({
  productCategory: z.string().trim().min(2).max(100),
  outputUnits: z.number().int().min(1).max(100_000),
  periodDate: z.string().min(4),
  notes: z.string().trim().max(500).optional(),
});

const DEMO_LOGS = [
  {
    id: "prod-1",
    productCategory: "Meja Makan Kayu Jati",
    outputUnits: 18,
    periodDate: "2026-11-16",
    notes: "Baseline minggu 1",
  },
  {
    id: "prod-2",
    productCategory: "Lemari Pakaian 2 Pintu",
    outputUnits: 12,
    periodDate: "2026-11-20",
    notes: "Baseline minggu 1-2",
  },
  {
    id: "prod-3",
    productCategory: "Meja Makan Kayu Jati",
    outputUnits: 21,
    periodDate: "2026-11-24",
    notes: "Pasca perbaikan jadwal idle",
  },
];

/**
 * Mencatat & mengevaluasi output produksi furnitur untuk menghitung
 * Specific Energy Consumption (SEC = kWh / unit produk sejenis).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(365, Math.max(7, Number(searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86_400_000);
  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return buildDemoResponse(days);
    }

    const [logs, energyAgg] = await Promise.all([
      db.productionLog.findMany({
        where: {
          workshopId: workshop.id,
          periodDate: { gte: since },
        },
        orderBy: { periodDate: "desc" },
      }),
      db.machineStateSession.aggregate({
        where: {
          machine: { workshopId: workshop.id },
          startedAt: { gte: since },
        },
        _sum: { energyKwh: true },
      }),
    ]);

    const totalOutputUnits = logs.reduce((sum, l) => sum + l.outputUnits, 0);
    const totalEnergyKwh = Number((energyAgg._sum.energyKwh ?? 0).toFixed(2));
    const secKwhPerUnit = calculateSpecificEnergyConsumption(
      totalEnergyKwh,
      totalOutputUnits
    );

    const byCategory = new Map<string, number>();
    for (const l of logs) {
      byCategory.set(
        l.productCategory,
        (byCategory.get(l.productCategory) ?? 0) + l.outputUnits
      );
    }

    return NextResponse.json({
      dataSource: "database",
      periodDays: days,
      summary: {
        totalEnergyKwh,
        totalOutputUnits,
        secKwhPerUnit,
        categories: Array.from(byCategory.entries()).map(([category, units]) => ({
          category,
          units,
        })),
      },
      logs: logs.map((l) => ({
        id: l.id,
        productCategory: l.productCategory,
        outputUnits: l.outputUnits,
        periodDate: l.periodDate.toISOString().slice(0, 10),
        notes: l.notes,
      })),
    });
  } catch {
    return buildDemoResponse(days);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = createProductionLogSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Data log produksi tidak valid.",
      },
      { status: 400 }
    );
  }

  const parsedDate = new Date(parsed.data.periodDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      { error: "Format periodDate tidak valid (gunakan YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json(
        {
          ok: true,
          persisted: false,
          log: {
            id: `demo-prod-${Date.now()}`,
            ...parsed.data,
            periodDate: parsedDate.toISOString().slice(0, 10),
          },
        },
        { status: 201 }
      );
    }

    const created = await db.productionLog.create({
      data: {
        workshopId: workshop.id,
        productCategory: parsed.data.productCategory,
        outputUnits: parsed.data.outputUnits,
        periodDate: parsedDate,
        notes: parsed.data.notes ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        persisted: true,
        log: {
          id: created.id,
          productCategory: created.productCategory,
          outputUnits: created.outputUnits,
          periodDate: created.periodDate.toISOString().slice(0, 10),
          notes: created.notes,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: true,
        persisted: false,
        log: {
          id: `demo-prod-${Date.now()}`,
          ...parsed.data,
          periodDate: parsedDate.toISOString().slice(0, 10),
        },
      },
      { status: 201 }
    );
  }
}

function buildDemoResponse(days: number) {
  const totalOutputUnits = DEMO_LOGS.reduce((sum, l) => sum + l.outputUnits, 0);
  const totalEnergyKwh = PERIOD_METRICS.month.totalEnergyKwh;
  return NextResponse.json({
    dataSource: "demo",
    periodDays: days,
    summary: {
      totalEnergyKwh,
      totalOutputUnits,
      secKwhPerUnit: calculateSpecificEnergyConsumption(
        totalEnergyKwh,
        totalOutputUnits
      ),
      categories: [
        { category: "Meja Makan Kayu Jati", units: 39 },
        { category: "Lemari Pakaian 2 Pintu", units: 12 },
      ],
    },
    logs: DEMO_LOGS,
  });
}
