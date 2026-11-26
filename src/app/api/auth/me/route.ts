import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WORKSHOP_INFO } from "@/lib/mock-dashboard-data";

export async function GET() {
  const session = await getCurrentSession();

  let esp32Online = WORKSHOP_INFO.esp32OnlineCount;
  let esp32Total = WORKSHOP_INFO.esp32TotalCount;

  try {
    const devices = await db.device.findMany({
      where: session?.workshopId
        ? { workshopId: session.workshopId }
        : undefined,
      select: { lastSeenAt: true },
    });
    if (devices.length > 0) {
      const cutoff = Date.now() - 60_000;
      esp32Total = devices.length;
      esp32Online = devices.filter(
        (d) => d.lastSeenAt && d.lastSeenAt.getTime() >= cutoff
      ).length;
    }
  } catch {
    // Fallback ke indikator status demo
  }

  return NextResponse.json({
    authenticated: Boolean(session),
    user: session,
    hardwareStatus: {
      connected: esp32Online > 0,
      esp32Online,
      esp32Total,
    },
  });
}
