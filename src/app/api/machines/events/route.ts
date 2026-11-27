import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

export interface MachineEventItem {
  id: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  timeLabel: string;
  durationSec: number;
  avgPowerW: number;
  energyKwh: number;
  message: string;
  tone: "default" | "warning";
}

function formatDurationShort(sec: number): string {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} menit`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}j ${m}m` : `${h} jam`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit")) || 12));
  const session = await getCurrentSession();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({ dataSource: "demo", events: [] });
    }

    const sessions = await db.machineStateSession.findMany({
      where: {
        machine: {
          workshopId: workshop.id,
          hasPhysicalSensor: true,
        },
      },
      include: {
        machine: {
          select: {
            id: true,
            code: true,
            name: true,
            idleAlertThresholdMin: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    const events: MachineEventItem[] = sessions.map((s) => {
      const durationMin = s.durationSec / 60;
      const isLongIdle =
        s.status === "IDLE" && durationMin >= s.machine.idleAlertThresholdMin;
      const timeLabel = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(s.startedAt);

      let message = `Aktif (${Math.round(s.avgPowerW).toLocaleString("id-ID")} W)`;
      if (s.status === "IDLE") {
        message = isLongIdle
          ? `Idle ${formatDurationShort(s.durationSec)} (${Math.round(s.avgPowerW).toLocaleString("id-ID")} W) — melewati batas ${s.machine.idleAlertThresholdMin} menit`
          : `Masuk mode Idle ${formatDurationShort(s.durationSec)} (${Math.round(s.avgPowerW).toLocaleString("id-ID")} W)`;
      } else if (s.status === "START_UP") {
        message = `Start-up motor terdeteksi (${Math.round(s.avgPowerW).toLocaleString("id-ID")} W · ${s.durationSec} dtk)`;
      } else if (s.status === "WORKING") {
        message = `Bekerja produktif ${formatDurationShort(s.durationSec)} · rata-rata ${Math.round(s.avgPowerW).toLocaleString("id-ID")} W`;
      } else if (s.status === "OFF") {
        message = `Mesin mati / standby (${Math.round(s.avgPowerW).toLocaleString("id-ID")} W)`;
      }

      return {
        id: s.id,
        machineId: s.machine.id,
        machineCode: s.machine.code,
        machineName: s.machine.name,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        timeLabel,
        durationSec: s.durationSec,
        avgPowerW: s.avgPowerW,
        energyKwh: s.energyKwh,
        message,
        tone: isLongIdle ? "warning" : "default",
      };
    });

    return NextResponse.json({
      dataSource: "database",
      count: events.length,
      events,
    });
  } catch {
    return NextResponse.json({ dataSource: "demo", events: [] });
  }
}
