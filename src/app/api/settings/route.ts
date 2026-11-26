import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  INITIAL_MACHINES,
  WORKSHOP_INFO,
  type PortfolioQuadrant,
} from "@/lib/mock-dashboard-data";

export interface SettingsMachineItem {
  id: string;
  code: string;
  name: string;
  machineType: string;
  ratedPowerW: number;
  annualOperatingHours: number;
  portfolioQuadrant: PortfolioQuadrant;
  hasPhysicalSensor: boolean;
  idleAlertThresholdMin: number;
  baselineIdleW: number;
  baselineWorkingW: number;
  isActive: boolean;
  deviceUid: string | null;
}

export interface SettingsPayload {
  dataSource: "database" | "demo";
  workshop: {
    id: string;
    code: string;
    name: string;
    location: string;
    tariffIdrPerKwh: number;
    workingDaysPerMonth: number;
    telegramChatId: string;
  };
  machines: SettingsMachineItem[];
}

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(200),
  tariffIdrPerKwh: z.number().min(100).max(20_000),
  workingDaysPerMonth: z.number().int().min(1).max(31),
  telegramChatId: z.string().trim().max(64).optional().default(""),
});

function buildDemoSettings(): SettingsPayload {
  return {
    dataSource: "demo",
    workshop: {
      id: "demo-ws-skh-01",
      code: WORKSHOP_INFO.code,
      name: WORKSHOP_INFO.name,
      location: WORKSHOP_INFO.location,
      tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
      workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
      telegramChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID ?? "",
    },
    machines: [
      ...INITIAL_MACHINES.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        machineType:
          m.code === "CNC-1325"
            ? "CNC"
            : m.code === "EDGE-01"
              ? "EDGE_BANDER"
              : m.code === "PSAW-01"
                ? "PANEL_SAW"
                : m.code === "DUST-01"
                  ? "DUST_COLLECTOR"
                  : m.code === "BOR-01"
                    ? "BORING"
                    : "COMPRESSOR",
        ratedPowerW: m.ratedPowerW,
        annualOperatingHours:
          m.portfolioQuadrant === "CRITICAL"
            ? 2200
            : m.portfolioQuadrant === "LEVERAGE_TIME"
              ? 2100
              : 1250,
        portfolioQuadrant: m.portfolioQuadrant,
        hasPhysicalSensor: m.hasPhysicalSensor,
        idleAlertThresholdMin: m.idleAlertThresholdMin,
        baselineIdleW: m.baselineIdleW,
        baselineWorkingW: m.baselineWorkingW,
        isActive: true,
        deviceUid: m.deviceUid,
      })),
      {
        id: "m-virtual-noncrit",
        code: "VIRTUAL-NONCRIT",
        name: "Beban Non-Prioritas (Virtual CT)",
        machineType: "VIRTUAL_AGGREGATE",
        ratedPowerW: 1500,
        annualOperatingHours: 800,
        portfolioQuadrant: "NONCRITICAL",
        hasPhysicalSensor: false,
        idleAlertThresholdMin: 30,
        baselineIdleW: 340,
        baselineWorkingW: 980,
        isActive: true,
        deviceUid: null,
      },
    ],
  };
}

export async function GET() {
  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json(buildDemoSettings());
    }

    const machinesDb = await db.machine.findMany({
      where: { workshopId: workshop.id },
      include: { device: { select: { deviceUid: true } } },
      orderBy: { createdAt: "asc" },
    });

    const payload: SettingsPayload = {
      dataSource: "database",
      workshop: {
        id: workshop.id,
        code: workshop.code,
        name: workshop.name,
        location: workshop.location,
        tariffIdrPerKwh: Number(workshop.tariffIdrPerKwh),
        workingDaysPerMonth: workshop.workingDaysPerMonth,
        telegramChatId: workshop.telegramChatId ?? "",
      },
      machines: machinesDb.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        machineType: m.machineType,
        ratedPowerW: m.ratedPowerW,
        annualOperatingHours: m.annualOperatingHours,
        portfolioQuadrant: m.portfolioQuadrant as PortfolioQuadrant,
        hasPhysicalSensor: m.hasPhysicalSensor,
        idleAlertThresholdMin: m.idleAlertThresholdMin,
        baselineIdleW: m.baselineIdleW,
        baselineWorkingW: m.baselineWorkingW,
        isActive: m.isActive,
        deviceUid: m.device?.deviceUid ?? null,
      })),
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(buildDemoSettings());
  }
}

export async function PATCH(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Parameter pengaturan tidak valid",
      },
      { status: 400 }
    );
  }

  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        workshop: parsed.data,
      });
    }

    const updated = await db.workshop.update({
      where: { id: workshop.id },
      data: {
        name: parsed.data.name,
        location: parsed.data.location,
        tariffIdrPerKwh: parsed.data.tariffIdrPerKwh,
        workingDaysPerMonth: parsed.data.workingDaysPerMonth,
        telegramChatId: parsed.data.telegramChatId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      persisted: true,
      workshop: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        location: updated.location,
        tariffIdrPerKwh: Number(updated.tariffIdrPerKwh),
        workingDaysPerMonth: updated.workingDaysPerMonth,
        telegramChatId: updated.telegramChatId ?? "",
      },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      persisted: false,
      workshop: parsed.data,
    });
  }
}
