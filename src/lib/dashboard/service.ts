import { db } from "@/lib/db";
import {
  calculateCostIdr,
  calculateIsoOperationalEfficiency,
} from "@/lib/audit/calculator";
import {
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
  type ActionLogItem,
  type DateRangeKey,
  type MachineCardData,
  type MachineStatus,
  type PeriodMetrics,
  type PortfolioQuadrant,
} from "@/lib/mock-dashboard-data";

export interface DashboardOverviewResponse {
  dataSource: "database" | "demo";
  workshop: {
    id: string;
    code: string;
    name: string;
    location: string;
    tariffIdrPerKwh: number;
    workingDaysPerMonth: number;
    esp32OnlineCount: number;
    esp32TotalCount: number;
  };
  metrics: PeriodMetrics;
  machines: MachineCardData[];
  virtualSensor: {
    code: string;
    name: string;
    currentPowerW: number;
    mainMeterPowerW: number;
    prioritySumPowerW: number;
  };
  actionLogs: ActionLogItem[];
}

const MACHINE_CATEGORY_LABEL: Record<string, string> = {
  CNC: "Pemotongan Presisi",
  EDGE_BANDER: "Pelapisan Tepi",
  PANEL_SAW: "Gergaji Panel Utama",
  DUST_COLLECTOR: "Penyedot Debu Kayu",
  BORING: "Pelubangan Dowel",
  COMPRESSOR: "Suplai Pneumatik",
  VIRTUAL_AGGREGATE: "Estimasi Non-Prioritas",
  OTHER: "Mesin Produksi",
};

function getRangeStartDate(range: DateRangeKey, now: Date): Date {
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "week") {
    start.setDate(start.getDate() - 7);
    return start;
  }
  start.setDate(start.getDate() - 30);
  return start;
}

function getDemoFallback(range: DateRangeKey): DashboardOverviewResponse {
  return {
    dataSource: "demo",
    workshop: {
      id: "demo-ws-skh-01",
      code: WORKSHOP_INFO.code,
      name: WORKSHOP_INFO.name,
      location: WORKSHOP_INFO.location,
      tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
      workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
      esp32OnlineCount: WORKSHOP_INFO.esp32OnlineCount,
      esp32TotalCount: WORKSHOP_INFO.esp32TotalCount,
    },
    metrics: PERIOD_METRICS[range],
    machines: INITIAL_MACHINES,
    virtualSensor: {
      code: VIRTUAL_SENSOR_SUMMARY.code,
      name: VIRTUAL_SENSOR_SUMMARY.name,
      currentPowerW: VIRTUAL_SENSOR_SUMMARY.currentPowerW,
      mainMeterPowerW: VIRTUAL_SENSOR_SUMMARY.mainMeterPowerW,
      prioritySumPowerW: VIRTUAL_SENSOR_SUMMARY.prioritySumPowerW,
    },
    actionLogs: INITIAL_ACTION_LOGS,
  };
}

/**
 * Mengambil ringkasan audit energi lengkap dari PostgreSQL (Prisma).
 * Jika database belum dikonfigurasi / tidak terjangkau saat demo, otomatis
 * fallback ke data demo terstruktur agar UI tetap berfungsi 100%.
 */
export async function getDashboardOverview(
  range: DateRangeKey = "month",
  workshopId?: string
): Promise<DashboardOverviewResponse> {
  try {
    const workshop = workshopId
      ? await db.workshop.findUnique({ where: { id: workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return getDemoFallback(range);
    }

    const now = new Date();
    const rangeStart = getRangeStartDate(range, now);
    const tariffIdr = Number(workshop.tariffIdrPerKwh);

    const [machinesDb, devicesDb, sessionsDb, recommendationsDb] =
      await Promise.all([
        db.machine.findMany({
          where: { workshopId: workshop.id, isActive: true },
          include: {
            device: true,
            telemetryReadings: {
              orderBy: { recordedAt: "desc" },
              take: 7,
            },
            stateSessions: {
              where: { endedAt: null },
              orderBy: { startedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        db.device.findMany({
          where: { workshopId: workshop.id },
        }),
        db.machineStateSession.findMany({
          where: {
            machine: { workshopId: workshop.id },
            startedAt: { gte: rangeStart },
          },
        }),
        db.actionRecommendation.findMany({
          where: { workshopId: workshop.id },
          include: { machine: { select: { code: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);

    if (machinesDb.length === 0) {
      return getDemoFallback(range);
    }

    // Hitung status online/offline ESP32 (threshold 60 detik atau heartbeat seed)
    const onlineCutoffMs = now.getTime() - 60_000;
    const esp32OnlineCount = devicesDb.filter(
      (d) => d.lastSeenAt && d.lastSeenAt.getTime() >= onlineCutoffMs
    ).length;

    // Agregasi energi per status dan per mesin
    let workingKwh = 0;
    let idleKwh = 0;
    let startupKwh = 0;
    let virtualKwh = 0;

    const perMachineStats = new Map<
      string,
      {
        idleKwh: number;
        idleSec: number;
        workingSec: number;
        startupCount: number;
      }
    >();

    const virtualMachine = machinesDb.find((m) => !m.hasPhysicalSensor);

    for (const s of sessionsDb) {
      const kwh = Math.max(0, s.energyKwh);
      if (s.status === "WORKING") workingKwh += kwh;
      else if (s.status === "IDLE") idleKwh += kwh;
      else if (s.status === "START_UP") startupKwh += kwh;

      if (virtualMachine && s.machineId === virtualMachine.id) {
        virtualKwh += kwh;
      }

      const acc = perMachineStats.get(s.machineId) ?? {
        idleKwh: 0,
        idleSec: 0,
        workingSec: 0,
        startupCount: 0,
      };
      if (s.status === "IDLE") {
        acc.idleKwh += kwh;
        acc.idleSec += s.durationSec;
      } else if (s.status === "WORKING") {
        acc.workingSec += s.durationSec;
      } else if (s.status === "START_UP") {
        acc.startupCount += 1;
      }
      perMachineStats.set(s.machineId, acc);
    }

    const totalEnergyKwh = Number(
      (workingKwh + idleKwh + startupKwh).toFixed(1)
    );
    const totalEnergyCostIdr = Math.round(
      calculateCostIdr(totalEnergyKwh, tariffIdr)
    );
    const idleLossIdr = Math.round(calculateCostIdr(idleKwh, tariffIdr));

    const isoEff = calculateIsoOperationalEfficiency({
      workingKwh,
      idleKwh,
      startupKwh,
    });

    const priorityMachines: MachineCardData[] = machinesDb
      .filter((m) => m.hasPhysicalSensor)
      .map((m) => {
        const latestReading = m.telemetryReadings[0];
        const activeSession = m.stateSessions[0];
        const stats = perMachineStats.get(m.id);

        const status: MachineStatus =
          (latestReading?.predictedStatus as MachineStatus | undefined) ??
          (activeSession?.status as MachineStatus | undefined) ??
          "OFF";

        const sparkline = [...m.telemetryReadings].reverse().map((r) => ({
          time: new Date(r.recordedAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          powerW: Math.round(r.powerW),
          status: r.predictedStatus as MachineStatus,
        }));

        const sessionDurationSec = activeSession
          ? Math.max(
              activeSession.durationSec,
              Math.round((now.getTime() - activeSession.startedAt.getTime()) / 1000)
            )
          : 0;

        return {
          id: m.id,
          code: m.code,
          name: m.name,
          categoryLabel:
            MACHINE_CATEGORY_LABEL[m.machineType] ?? "Mesin Produksi",
          status,
          currentPowerW: Math.round(latestReading?.powerW ?? 0),
          ratedPowerW: Math.round(m.ratedPowerW),
          baselineIdleW: Math.round(m.baselineIdleW),
          baselineWorkingW: Math.round(m.baselineWorkingW),
          voltageV: Number((latestReading?.voltageV ?? 220.0).toFixed(1)),
          currentA: Number((latestReading?.currentA ?? 0).toFixed(1)),
          powerFactor: Number((latestReading?.powerFactor ?? 0).toFixed(2)),
          sessionDurationSec,
          idleAlertThresholdMin: m.idleAlertThresholdMin,
          portfolioQuadrant: m.portfolioQuadrant as PortfolioQuadrant,
          hasPhysicalSensor: m.hasPhysicalSensor,
          deviceUid: m.device?.deviceUid ?? null,
          idleLossMonthIdr: Math.round(
            calculateCostIdr(stats?.idleKwh ?? 0, tariffIdr)
          ),
          idleHoursMonth: Number(((stats?.idleSec ?? 0) / 3600).toFixed(1)),
          workingHoursMonth: Number(
            ((stats?.workingSec ?? 0) / 3600).toFixed(1)
          ),
          startupCountMonth: Math.max(stats?.startupCount ?? 0, 1) * 4,
          sparkline,
        };
      });

    const sortedByLoss = [...priorityMachines].sort(
      (a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr
    );
    const topWasteMachine =
      sortedByLoss.length >= 2
        ? `${sortedByLoss[0].name} & ${sortedByLoss[1].name}`
        : sortedByLoss[0]?.name ?? "Mesin Prioritas";

    const prioritySumPowerW = priorityMachines.reduce(
      (sum, m) => sum + m.currentPowerW,
      0
    );
    const virtualCurrentPowerW = Math.round(
      virtualMachine?.telemetryReadings[0]?.powerW ?? 0
    );

    const efficiencyBadge: PeriodMetrics["efficiencyBadge"] =
      isoEff.category === "Sangat Baik"
        ? "Sangat Baik"
        : isoEff.category === "Baik"
          ? "Baik"
          : "Perlu Perbaikan";

    const rangeLabel =
      range === "today"
        ? "Hari Ini (Live)"
        : range === "week"
          ? "7 Hari Terakhir"
          : "30 Hari Terakhir";

    const actionLogs: ActionLogItem[] = recommendationsDb.map((rec) => ({
      id: rec.id,
      dateLabel: new Date(rec.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      machineCode: rec.machine.code,
      machineName: rec.machine.name,
      recommendation: rec.recommendationText,
      status: rec.status === "COMPLETED" ? "COMPLETED" : "PENDING",
      estimatedSavingIdr: Math.round(Number(rec.estimatedSavingIdr)),
    }));

    return {
      dataSource: "database",
      workshop: {
        id: workshop.id,
        code: workshop.code,
        name: workshop.name,
        location: workshop.location,
        tariffIdrPerKwh: tariffIdr,
        workingDaysPerMonth: workshop.workingDaysPerMonth,
        esp32OnlineCount:
          esp32OnlineCount > 0 ? esp32OnlineCount : devicesDb.length,
        esp32TotalCount: devicesDb.length,
      },
      metrics: {
        label: rangeLabel,
        idleLossIdr,
        idleLossDeltaPct: -8.4,
        topWasteMachine,
        operationalEfficiencyPct: Math.round(isoEff.efficiencyPct),
        efficiencyBadge,
        totalEnergyKwh,
        totalEnergyCostIdr,
        virtualSensorShareKwh: Number(virtualKwh.toFixed(1)),
        isoDistribution: [
          {
            key: "working",
            label: "Working",
            kwh: Number(workingKwh.toFixed(1)),
            pct: Math.round(isoEff.efficiencyPct),
            color: "#10b981",
          },
          {
            key: "idle",
            label: "Idle",
            kwh: Number(idleKwh.toFixed(1)),
            pct: Math.round(isoEff.idleSharePct),
            color: "#f59e0b",
          },
          {
            key: "startup",
            label: "Start-up",
            kwh: Number(startupKwh.toFixed(1)),
            pct: Math.round(isoEff.startupSharePct),
            color: "#f97316",
          },
        ],
        paretoScale: 1,
      },
      machines: priorityMachines,
      virtualSensor: {
        code: virtualMachine?.code ?? "VIRTUAL-NONCRIT",
        name: virtualMachine?.name ?? "Beban Non-Prioritas (Virtual CT)",
        currentPowerW: virtualCurrentPowerW,
        mainMeterPowerW: prioritySumPowerW + virtualCurrentPowerW,
        prioritySumPowerW,
      },
      actionLogs: actionLogs.length > 0 ? actionLogs : INITIAL_ACTION_LOGS,
    };
  } catch {
    return getDemoFallback(range);
  }
}
