"use client";

import * as React from "react";
import { ArrowUpRight, Download, Play, RefreshCw } from "lucide-react";
import type { MachineEventItem } from "@/app/api/machines/events/route";
import { EnergyConsumptionCard } from "@/components/dashboard/energy-consumption-card";
import { AppShell } from "@/components/layout/app-shell";
import { MachineTelemetryDialog } from "@/components/machines/machine-telemetry-dialog";
import { Button } from "@/components/ui/button";
import {
  machineStatusToPill,
  StatusPill,
} from "@/components/ui/wattwise-badges";
import type { DashboardOverviewResponse } from "@/lib/dashboard/service";
import {
  mergeStreamSnapshotIntoMachines,
  type StreamMachineSnapshot,
} from "@/lib/stream/merge-snapshot";
import {
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
  type MachineCardData,
  type MachineStatus,
} from "@/lib/mock-dashboard-data";

type FilterStatus = "ALL" | MachineStatus;

interface EventLogEntry {
  id: string;
  time: string;
  machineName: string;
  message: string;
  tone: "default" | "warning";
}

function formatHoursMinutes(totalSec: number): string {
  const mins = Math.max(1, Math.round(totalSec / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}j ${String(m).padStart(2, "0")}m`;
}

const DEFAULT_EVENT_TIMES = ["08:41", "08:30", "08:12", "07:55", "07:02"];

function buildInitialEvents(
  machines: MachineCardData[],
  nowMs?: number
): EventLogEntry[] {
  const fmt = (idx: number, minsAgo: number) =>
    nowMs
      ? new Date(nowMs - minsAgo * 60_000).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : (DEFAULT_EVENT_TIMES[idx] ?? "08:00");

  return machines.slice(0, 5).map((m, idx) => {
    if (m.status === "IDLE") {
      return {
        id: `evt-${m.id}`,
        time: fmt(idx, idx * 14 + 6),
        machineName: m.name,
        message: `Idle lebih dari ${m.idleAlertThresholdMin} menit (${m.currentPowerW.toLocaleString("id-ID")} W), pertimbangkan dimatikan`,
        tone: "warning",
      };
    }
    if (m.status === "START_UP") {
      return {
        id: `evt-${m.id}`,
        time: fmt(idx, idx * 14 + 4),
        machineName: m.name,
        message: "Lonjakan arus awal terdeteksi saat mesin dinyalakan",
        tone: "default",
      };
    }
    if (m.status === "OFF") {
      return {
        id: `evt-${m.id}`,
        time: fmt(idx, idx * 14 + 12),
        machineName: m.name,
        message: "Dimatikan manual oleh operator (standby 0–5 W)",
        tone: "default",
      };
    }
    return {
      id: `evt-${m.id}`,
      time: fmt(idx, idx * 14 + 2),
      machineName: m.name,
      message: `Beralih ke Working — beban aktif ${m.currentPowerW.toLocaleString("id-ID")} W`,
      tone: "default",
    };
  });
}

export function MachinesPageClient() {
  const [overview, setOverview] = React.useState<DashboardOverviewResponse>({
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
    metrics: PERIOD_METRICS.today,
    machines: INITIAL_MACHINES,
    virtualSensor: VIRTUAL_SENSOR_SUMMARY,
    actionLogs: INITIAL_ACTION_LOGS,
  });
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("ALL");
  const [events, setEvents] = React.useState<EventLogEntry[]>(() =>
    buildInitialEvents(INITIAL_MACHINES)
  );
  const [eventsFromDb, setEventsFromDb] = React.useState(false);
  const [selectedMachine, setSelectedMachine] =
    React.useState<MachineCardData | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState("Baru saja");
  const [tickBusy, setTickBusy] = React.useState(false);

  const loadOverview = React.useCallback(async () => {
    try {
      const [overviewRes, eventsRes] = await Promise.all([
        fetch("/api/dashboard/overview?range=today", { cache: "no-store" }),
        fetch("/api/machines/events?limit=8", { cache: "no-store" }),
      ]);

      let loadedMachines: MachineCardData[] | null = null;
      if (overviewRes.ok) {
        const data = (await overviewRes.json()) as DashboardOverviewResponse;
        if (data?.machines) {
          setOverview(data);
          loadedMachines = data.machines;
          setLastUpdated(
            new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB"
          );
        }
      }

      if (eventsRes.ok) {
        const evData = (await eventsRes.json()) as {
          dataSource?: "database" | "demo";
          events?: MachineEventItem[];
        };
        if (Array.isArray(evData.events) && evData.events.length > 0) {
          setEvents(
            evData.events.map((ev) => ({
              id: ev.id,
              time: ev.timeLabel,
              machineName: ev.machineName,
              message: ev.message,
              tone: ev.tone,
            }))
          );
          setEventsFromDb(evData.dataSource === "database");
          return;
        }
      }

      if (loadedMachines) {
        setEvents(buildInitialEvents(loadedMachines, Date.now()));
        setEventsFromDb(false);
      }
    } catch {
      // fallback tetap tampil
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/dashboard/overview?range=today", { cache: "no-store" }).then(
        (res) =>
          res.ok ? (res.json() as Promise<DashboardOverviewResponse>) : null
      ),
      fetch("/api/machines/events?limit=8", { cache: "no-store" }).then((res) =>
        res.ok
          ? (res.json() as Promise<{
              dataSource?: "database" | "demo";
              events?: MachineEventItem[];
            }>)
          : null
      ),
    ])
      .then(([data, evData]) => {
        if (!active) return;
        if (data?.machines) {
          setOverview(data);
          setLastUpdated(
            new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB"
          );
        }

        if (Array.isArray(evData?.events) && evData.events.length > 0) {
          setEvents(
            evData.events.map((ev) => ({
              id: ev.id,
              time: ev.timeLabel,
              machineName: ev.machineName,
              message: ev.message,
              tone: ev.tone,
            }))
          );
          setEventsFromDb(evData.dataSource === "database");
        } else if (data?.machines) {
          setEvents(buildInitialEvents(data.machines, Date.now()));
          setEventsFromDb(false);
        }
      })
      .catch(() => null);

    const es = new EventSource("/api/stream");
    const handleStreamSnapshot = (ev: Event) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as {
          machines?: StreamMachineSnapshot[];
          virtualSensor?: DashboardOverviewResponse["virtualSensor"];
          esp32OnlineCount?: number;
          esp32TotalCount?: number;
          timestamp?: string;
        };
        if (Array.isArray(parsed.machines) && parsed.machines.length > 0) {
          setOverview((prev) => ({
            ...prev,
            workshop: {
              ...prev.workshop,
              esp32OnlineCount:
                typeof parsed.esp32OnlineCount === "number"
                  ? parsed.esp32OnlineCount
                  : prev.workshop.esp32OnlineCount,
              esp32TotalCount:
                typeof parsed.esp32TotalCount === "number"
                  ? parsed.esp32TotalCount
                  : prev.workshop.esp32TotalCount,
            },
            machines: mergeStreamSnapshotIntoMachines(
              prev.machines,
              parsed.machines!
            ),
            virtualSensor: parsed.virtualSensor ?? prev.virtualSensor,
          }));
          setLastUpdated(
            new Date(parsed.timestamp ?? Date.now()).toLocaleTimeString(
              "id-ID",
              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
            ) + " WIB"
          );
        }
      } catch {
        // abaikan event malformed
      }
    };

    es.addEventListener("snapshot", handleStreamSnapshot);
    es.addEventListener("telemetry", handleStreamSnapshot);

    return () => {
      active = false;
      es.close();
    };
  }, []);

  async function handleSimulateTick() {
    setTickBusy(true);
    try {
      await fetch("/api/simulator/demo-tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "normal", persist: true }),
      });
      await loadOverview();
    } finally {
      setTickBusy(false);
    }
  }

  function handleExportCsv() {
    const a = document.createElement("a");
    a.href = "/api/export/audit?range=today";
    a.download = "wattwise-monitoring-mesin.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const counts = React.useMemo(
    () => ({
      ALL: overview.machines.length,
      WORKING: overview.machines.filter((m) => m.status === "WORKING").length,
      IDLE: overview.machines.filter((m) => m.status === "IDLE").length,
      START_UP: overview.machines.filter((m) => m.status === "START_UP").length,
      OFF: overview.machines.filter((m) => m.status === "OFF").length,
    }),
    [overview.machines]
  );

  const visibleMachines = React.useMemo(
    () =>
      filterStatus === "ALL"
        ? overview.machines
        : overview.machines.filter((m) => m.status === filterStatus),
    [filterStatus, overview.machines]
  );

  const totalCurrentW = overview.machines.reduce(
    (s, m) => s + m.currentPowerW,
    0
  );
  const totalRatedW = overview.machines.reduce((s, m) => s + m.ratedPowerW, 0);

  return (
    <AppShell
      title="Monitoring Mesin"
      section="Menu Utama"
      dataSource={overview.dataSource}
      workshopName={overview.workshop.name}
      onlineDevices={overview.workshop.esp32OnlineCount}
      totalDevices={overview.workshop.esp32TotalCount}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Title & Action Buttons */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Monitoring Mesin
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              {overview.machines.length} mesin di {overview.workshop.name} ·
              Pembaruan langsung · Terakhir {lastUpdated}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={tickBusy}
              onClick={handleSimulateTick}
              className="h-9 gap-1.5 rounded-lg border-border bg-card px-3 text-xs font-medium"
            >
              {tickBusy ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              <span>Simulasi Tick</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 gap-1.5 rounded-lg border-border bg-card px-3 text-xs font-medium"
            >
              <Download className="size-3.5" />
              <span>Ekspor CSV</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar (horizontal scroll on mobile) + Total Load Summary */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="no-scrollbar flex max-w-full overflow-x-auto">
            <div className="inline-flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
              {(
                [
                  ["ALL", `Semua · ${counts.ALL}`],
                  ["WORKING", `Working · ${counts.WORKING}`],
                  ["IDLE", `Idle · ${counts.IDLE}`],
                  ["START_UP", `Start-up · ${counts.START_UP}`],
                  ["OFF", `Off · ${counts.OFF}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterStatus(key)}
                  className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                    filterStatus === key
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Beban aktif:{" "}
            <span className="font-mono font-semibold text-foreground">
              {totalCurrentW.toLocaleString("id-ID")} W
            </span>{" "}
            /{" "}
            <span className="font-mono font-medium text-foreground">
              {totalRatedW.toLocaleString("id-ID")} W
            </span>{" "}
            terpasang
          </p>
        </div>

        {/* 3x2 Machine Cards Grid — Exact Figma 02 · Monitoring Mesin */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMachines.map((m) => {
            const pill = machineStatusToPill(m.status);
            const loadPct = Math.min(
              100,
              Math.round((m.currentPowerW / Math.max(1, m.ratedPowerW)) * 100)
            );
            const todayKwh = Number(
              (
                ((m.workingHoursMonth + m.idleHoursMonth) / 26) *
                (m.currentPowerW > 0
                  ? Math.max(m.baselineIdleW, m.currentPowerW)
                  : m.baselineWorkingW) /
                1000
              ).toFixed(1)
            );
            const barColor =
              m.status === "WORKING"
                ? "bg-[#059669]"
                : m.status === "IDLE"
                  ? "bg-[#D97706]"
                  : m.status === "START_UP"
                    ? "bg-[#2563EB]"
                    : "bg-zinc-400";

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14.5px] font-semibold text-foreground">
                      {m.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.categoryLabel} · {m.deviceUid ?? "Virtual CT"}
                    </p>
                  </div>
                  <StatusPill label={pill.label} tone={pill.tone} />
                </div>

                {/* 3 Metrics Row */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Daya</p>
                    <p className="mt-0.5 font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
                      {m.currentPowerW.toLocaleString("id-ID")} W
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      Hari ini
                    </p>
                    <p className="mt-0.5 font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
                      {todayKwh.toLocaleString("id-ID")} kWh
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      Jam operasi
                    </p>
                    <p className="mt-0.5 font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
                      {formatHoursMinutes(m.sessionDurationSec)}
                    </p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">
                      Beban dari kapasitas{" "}
                      {m.ratedPowerW.toLocaleString("id-ID")} W
                    </span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {loadPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer: Idle Threshold + Per-Machine Telemetry Detail */}
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-[11.5px]">
                  <span className="text-muted-foreground">
                    Batas idle {m.idleAlertThresholdMin} mnt
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMachine(m)}
                    className="inline-flex items-center gap-1 font-medium text-[#047857] transition-colors hover:text-[#059669] dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    <span>Detail telemetri</span>
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Bottom 2-Col: Log Kejadian Hari Ini + Konsumsi Energi Chart */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              Log Kejadian Terbaru
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {eventsFromDb
                ? "Riwayat perubahan kondisi mesin terbaru dari sensor aktif"
                : "Riwayat perubahan kondisi mesin terbaru"}
            </p>
            <div className="mt-4 space-y-4">
              {events.map((ev) => (
                <div key={ev.id} className="space-y-0.5 text-xs">
                  <p
                    className={`font-medium ${
                      ev.tone === "warning"
                        ? "text-[#B45309] dark:text-amber-400"
                        : "text-foreground"
                    }`}
                  >
                    <span className="font-mono">{ev.time}</span> ·{" "}
                    {ev.machineName}
                  </p>
                  <p
                    className={
                      ev.tone === "warning"
                        ? "text-[#B45309]/90 dark:text-amber-300/90"
                        : "text-muted-foreground"
                    }
                  >
                    {ev.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 xl:col-span-8">
            <EnergyConsumptionCard
              machines={overview.machines}
              totalEnergyKwh={overview.metrics.totalEnergyKwh}
              tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
            />
          </div>
        </section>
      </div>

      <MachineTelemetryDialog
        key={selectedMachine?.id ?? "closed"}
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </AppShell>
  );
}
