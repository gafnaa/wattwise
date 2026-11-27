"use client";

import * as React from "react";
import {
  Clock,
  Download,
  PauseCircle,
  PlayCircle,
  Wallet,
  Zap,
} from "lucide-react";
import { Skeleton } from "skullet/react";
import { AiInsightCard } from "@/components/dashboard/ai-insight-card";
import { EnergyConsumptionCard } from "@/components/dashboard/energy-consumption-card";
import { EnergyPerMachineCard } from "@/components/dashboard/energy-per-machine-card";
import { MachineStatusDonutCard } from "@/components/dashboard/machine-status-donut-card";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { KpiMetricCard } from "@/components/ui/wattwise-badges";
import type { DashboardOverviewResponse } from "@/lib/dashboard/service";
import {
  formatRupiah,
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
  type DateRangeKey,
} from "@/lib/mock-dashboard-data";

function buildDefaultOverview(range: DateRangeKey): DashboardOverviewResponse {
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
    virtualSensor: VIRTUAL_SENSOR_SUMMARY,
    actionLogs: INITIAL_ACTION_LOGS,
  };
}

function getGreetingFromDate(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export function DashboardShell() {
  const [range, setRange] = React.useState<DateRangeKey>("month");
  const [overview, setOverview] = React.useState<DashboardOverviewResponse>(() =>
    buildDefaultOverview("month")
  );
  const [loading, setLoading] = React.useState(true);
  const [greeting, setGreeting] = React.useState("Ringkasan Energi");
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState("Baru saja");

  React.useEffect(() => {
    let cancelled = false;

    fetch(`/api/dashboard/overview?range=${range}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardOverviewResponse | null) => {
        if (!cancelled) {
          const now = new Date();
          setGreeting(`${getGreetingFromDate(now)}, Pemilik Pabrik`);
          if (data?.metrics) {
            setOverview(data);
            setLastUpdatedLabel(
              now.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }) + " WIB"
            );
          }
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  function handleRangeChange(next: DateRangeKey) {
    setLoading(true);
    setRange(next);
  }

  function handleExportCsv() {
    const a = document.createElement("a");
    a.href = `/api/export/audit?range=${range}`;
    a.download = `wattwise-audit-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const idleKwh = Number(
    (
      overview.metrics.idleLossIdr /
      Math.max(1, overview.workshop.tariffIdrPerKwh)
    ).toFixed(1)
  );
  const idleSharePct =
    overview.metrics.totalEnergyKwh > 0
      ? Number(((idleKwh / overview.metrics.totalEnergyKwh) * 100).toFixed(1))
      : 0;
  const workingMachines = overview.machines.filter(
    (m) => m.status === "WORKING"
  );
  const startupMachines = overview.machines.filter(
    (m) => m.status === "START_UP"
  );
  const activeMachinesCount = workingMachines.length + startupMachines.length;
  const idleMachines = overview.machines.filter((m) => m.status === "IDLE");
  const pendingRecsCount = overview.actionLogs.filter(
    (a) => a.status === "PENDING"
  ).length;

  return (
    <AppShell
      title="Ringkasan"
      section="Menu Utama"
      dataSource={overview.dataSource}
      workshopName={overview.workshop.name}
      onlineDevices={overview.workshop.esp32OnlineCount}
      totalDevices={overview.workshop.esp32TotalCount}
      pendingRecommendationsCount={pendingRecsCount}
      range={range}
      onRangeChange={handleRangeChange}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Single Authoritative Page Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              {greeting}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              {overview.machines.length} mesin prioritas di{" "}
              {overview.workshop.name} · Pembaruan terakhir {lastUpdatedLabel}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 self-start rounded-lg border-border bg-card px-3.5 text-xs font-medium sm:self-auto"
          >
            <Download className="size-3.5" />
            <span>Ekspor CSV</span>
          </Button>
        </div>

        {/* Tier 1: 3 Primary Financial & Energy KPIs */}
        <Skeleton loading={loading}>
          <div className="space-y-4">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiMetricCard
                icon={<Zap className="size-4" />}
                iconTone="emerald"
                title="Total Konsumsi Energi"
                source="sensor"
                value={overview.metrics.totalEnergyKwh.toLocaleString("id-ID", {
                  maximumFractionDigits: 1,
                })}
                unit="kWh"
                trendLabel={`${overview.metrics.idleLossDeltaPct}%`}
                trendDirection={
                  overview.metrics.idleLossDeltaPct <= 0 ? "down" : "up"
                }
                trendTone={
                  overview.metrics.idleLossDeltaPct <= 0
                    ? "positive"
                    : "warning"
                }
                subtitle="vs periode sebelumnya"
              />

              <KpiMetricCard
                icon={<Wallet className="size-4" />}
                iconTone="zinc"
                title="Estimasi Biaya Listrik"
                source="kalkulasi"
                value={formatRupiah(overview.metrics.totalEnergyCostIdr)}
                trendLabel={`ISO ${overview.metrics.operationalEfficiencyPct}%`}
                trendDirection="down"
                trendTone="positive"
                subtitle={`Rp ${overview.workshop.tariffIdrPerKwh.toLocaleString("id-ID")}/kWh`}
              />

              <KpiMetricCard
                icon={<Clock className="size-4" />}
                iconTone="amber"
                title="Estimasi Biaya Idle"
                source="prediksi-ml"
                value={formatRupiah(overview.metrics.idleLossIdr)}
                trendLabel={`${idleSharePct}% energi`}
                trendDirection="up"
                trendTone="warning"
                subtitle={`tertinggi: ${overview.metrics.topWasteMachine}`}
              />
            </section>

            {/* Tier 2: Compact Hairline-Divided Live Operational Strip (breaks 6-identical-card monotony) */}
            <section className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <PauseCircle className="size-3.5 text-[#D97706]" />
                    <span>Energi Saat Idle</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {idleSharePct}% dari total konsumsi periode ini
                  </p>
                </div>
                <p className="shrink-0 font-mono text-lg font-semibold text-foreground tabular-nums">
                  {idleKwh.toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    kWh
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <PlayCircle className="size-3.5 text-[#059669]" />
                    <span>Mesin Aktif</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {workingMachines.length} Working · {startupMachines.length}{" "}
                    Start-up
                  </p>
                </div>
                <p className="shrink-0 font-mono text-lg font-semibold text-foreground tabular-nums">
                  {activeMachinesCount}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{overview.machines.length}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <PauseCircle className="size-3.5 text-[#D97706]" />
                    <span>Sedang Idle</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {idleMachines.length > 0
                      ? idleMachines.map((m) => m.name).join(", ")
                      : "Tidak ada mesin idle saat ini"}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-lg font-semibold text-foreground tabular-nums">
                  {idleMachines.length}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    mesin
                  </span>
                </p>
              </div>
            </section>
          </div>
        </Skeleton>

        {/* Row 2: Energy Consumption Chart + Live Machine Status Donut */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <EnergyConsumptionCard
              machines={overview.machines}
              totalEnergyKwh={overview.metrics.totalEnergyKwh}
              tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
            />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <MachineStatusDonutCard
              machines={overview.machines}
              metrics={overview.metrics}
            />
          </div>
        </section>

        {/* Row 3: Energy Per Machine + AI Insight */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            <EnergyPerMachineCard
              machines={overview.machines}
              tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
              periodLabel={overview.metrics.label}
            />
          </div>
          <div className="min-w-0">
            <AiInsightCard actionLogs={overview.actionLogs} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
