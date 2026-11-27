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
import {
  DataSourceBadge,
  KpiMetricCard,
} from "@/components/ui/wattwise-badges";
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
  const [greeting, setGreeting] = React.useState("Selamat datang");
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState("Baru saja");

  React.useEffect(() => {
    let cancelled = false;

    fetch(`/api/dashboard/overview?range=${range}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardOverviewResponse | null) => {
        if (!cancelled) {
          const now = new Date();
          setGreeting(getGreetingFromDate(now));
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
      <div className="space-y-6">
        {/* Greeting + Legend + Export Row */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              {greeting}, Pemilik Pabrik
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pemantauan {overview.machines.length} mesin prioritas di{" "}
              {overview.workshop.name} · Data terakhir diterima{" "}
              {lastUpdatedLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted-foreground xl:inline">
              Sumber data:
            </span>
            <DataSourceBadge kind="sensor" />
            <DataSourceBadge kind="kalkulasi" />
            <DataSourceBadge kind="prediksi-ml" />
            <DataSourceBadge kind="rekomendasi-ai" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="ml-1 h-8 gap-1.5 rounded-lg border-border bg-card text-xs font-medium"
            >
              <Download className="size-3.5" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* 6 KPI Cards (3x2 Grid — Exact Figma 01 · Ringkasan) */}
        <Skeleton loading={loading}>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                overview.metrics.idleLossDeltaPct <= 0 ? "positive" : "warning"
              }
              subtitle={`vs periode sebelumnya`}
            />

            <KpiMetricCard
              icon={<Wallet className="size-4" />}
              iconTone="zinc"
              title="Estimasi Biaya Listrik"
              source="kalkulasi"
              value={formatRupiah(overview.metrics.totalEnergyCostIdr)}
              trendLabel={`Efisiensi ${overview.metrics.operationalEfficiencyPct}%`}
              trendDirection="down"
              trendTone="positive"
              subtitle={`tarif Rp ${overview.workshop.tariffIdrPerKwh.toLocaleString("id-ID")}/kWh`}
            />

            <KpiMetricCard
              icon={<PauseCircle className="size-4" />}
              iconTone="amber"
              title="Energi Saat Idle"
              source="prediksi-ml"
              value={idleKwh.toLocaleString("id-ID")}
              unit="kWh"
              trendLabel={`${idleSharePct}%`}
              trendDirection="up"
              trendTone="warning"
              subtitle="dari total konsumsi"
            />

            <KpiMetricCard
              icon={<Clock className="size-4" />}
              iconTone="amber"
              title="Estimasi Biaya Idle"
              source="kalkulasi"
              value={formatRupiah(overview.metrics.idleLossIdr)}
              trendLabel={overview.metrics.efficiencyBadge}
              trendDirection="up"
              trendTone="warning"
              subtitle={`tertinggi: ${overview.metrics.topWasteMachine}`}
            />

            <KpiMetricCard
              icon={<PlayCircle className="size-4" />}
              iconTone="emerald"
              title="Mesin Aktif"
              source="prediksi-ml"
              value={activeMachinesCount}
              unit={`/ ${overview.machines.length} mesin`}
              subtitle={`${workingMachines.length} Working · ${startupMachines.length} Start-up`}
            />

            <KpiMetricCard
              icon={<PauseCircle className="size-4" />}
              iconTone="amber"
              title="Mesin dalam Kondisi Idle"
              source="prediksi-ml"
              value={idleMachines.length}
              unit="mesin"
              subtitle={
                idleMachines.length > 0
                  ? idleMachines.map((m) => m.name).join(", ")
                  : "Semua mesin bekerja optimal atau mati"
              }
            />
          </section>
        </Skeleton>

        {/* Row 2: Energy Consumption Chart (2fr) + Status Donut (1fr) */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <EnergyConsumptionCard
              machines={overview.machines}
              totalEnergyKwh={overview.metrics.totalEnergyKwh}
              tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
            />
          </div>
          <div className="xl:col-span-4">
            <MachineStatusDonutCard
              machines={overview.machines}
              metrics={overview.metrics}
            />
          </div>
        </section>

        {/* Row 3: Energy Per Machine (1fr) + AI Insight Card (1fr) */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <EnergyPerMachineCard
            machines={overview.machines}
            tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
            periodLabel={overview.metrics.label}
          />
          <AiInsightCard actionLogs={overview.actionLogs} />
        </section>
      </div>
    </AppShell>
  );
}
