import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_HEARTBEAT_TIMEOUT_SEC,
  evaluateDeviceOnlineStatus,
} from "@/lib/iot/device-utils";
import { INITIAL_MACHINES } from "@/lib/mock-dashboard-data";

export async function GET() {
  const session = await getCurrentSession();
  const now = new Date();

  try {
    const devices = await db.device.findMany({
      where: session?.workshopId
        ? { workshopId: session.workshopId }
        : undefined,
      include: {
        machine: {
          select: { id: true, code: true, name: true, portfolioQuadrant: true },
        },
      },
      orderBy: [{ isMainMeter: "desc" }, { deviceUid: "asc" }],
    });

    if (devices.length === 0) {
      return NextResponse.json(buildDemoDeviceStatus(now));
    }

    const mapped = devices.map((d) => {
      const hb = evaluateDeviceOnlineStatus(
        d.lastSeenAt,
        now,
        DEFAULT_HEARTBEAT_TIMEOUT_SEC
      );
      return {
        id: d.id,
        deviceUid: d.deviceUid,
        isMainMeter: d.isMainMeter,
        firmwareVersion: d.firmwareVersion,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        status: hb.status,
        secondsSinceLastSeen: hb.secondsSinceLastSeen,
        machine: d.machine,
      };
    });

    const onlineCount = mapped.filter((d) => d.status === "ONLINE").length;

    return NextResponse.json({
      dataSource: "database",
      heartbeatTimeoutSec: DEFAULT_HEARTBEAT_TIMEOUT_SEC,
      totalCount: mapped.length,
      onlineCount,
      offlineCount: mapped.length - onlineCount,
      devices: mapped,
    });
  } catch {
    return NextResponse.json(buildDemoDeviceStatus(now));
  }
}

function buildDemoDeviceStatus(now: Date) {
  const isoNow = now.toISOString();
  const devices = [
    {
      id: "dev-main-01",
      deviceUid: "ESP32-MAIN-01",
      isMainMeter: true,
      firmwareVersion: "1.0.0",
      lastSeenAt: isoNow,
      status: "ONLINE" as const,
      secondsSinceLastSeen: 2,
      machine: null,
    },
    ...INITIAL_MACHINES.filter((m) => m.deviceUid).map((m, idx) => ({
      id: `dev-${idx + 1}`,
      deviceUid: m.deviceUid!,
      isMainMeter: false,
      firmwareVersion: "1.0.0",
      lastSeenAt: isoNow,
      status: "ONLINE" as const,
      secondsSinceLastSeen: 3 + idx,
      machine: {
        id: m.id,
        code: m.code,
        name: m.name,
        portfolioQuadrant: m.portfolioQuadrant,
      },
    })),
  ];

  return {
    dataSource: "demo",
    heartbeatTimeoutSec: DEFAULT_HEARTBEAT_TIMEOUT_SEC,
    totalCount: devices.length,
    onlineCount: devices.length,
    offlineCount: 0,
    devices,
  };
}
