"use client";

import * as React from "react";
import { Download, Gauge, Wallet, Zap } from "lucide-react";
import { AiInsightCard } from "@/components/dashboard/ai-insight-card";
import { EnergyConsumptionCard } from "@/components/dashboard/energy-consumption-card";
import { EnergyPerMachineCard } from "@/components/dashboard/energy-per-machine-card";
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

export function AnalyticsPageClient() {
  const [range, setRange] = React.useState<DateRangeKey>("month");
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
    metrics: PERIOD_METRICS.month,
    machines: INITIAL_MACHINES,
    virtualSensor: VIRTUAL_SENSOR_SUMMARY,
    actionLogs: INITIAL_ACTION_LOGS,
  });

  React.useEffect(() => {
    let active = true;
    fetch(`/api/dashboard/overview?range=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DashboardOverviewResponse | null) => {
        if (active && data?.metrics) setOverview(data);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [range]);

  const peakLoadKw = Number(
    (
      Math.max(
        overview.virtualSensor.mainMeterPowerW,
        overview.machines.reduce((s, m) => s + m.currentPowerW, 0)
      ) / 1000
    ).toFixed(1)
  );

  function handleExportCsv() {
    const a = document.createElement("a");
    a.href = `/api/export/audit?range=${range}`;
    a.download = `wattwise-analisis-energi-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AppShell
      title="Analisis Energi"
      section="Menu Utama"
      dataSource={overview.dataSource}
      workshopName={overview.workshop.name}
      onlineDevices={overview.workshop.esp32OnlineCount}
      totalDevices={overview.workshop.esp32TotalCount}
      range={range}
      onRangeChange={setRange}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Analisis Energi
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              Perbandingan konsumsi {overview.metrics.label.toLowerCase()} ·
              Virtual CT non-prioritas:{" "}
              <span className="font-mono font-medium text-foreground">
                {overview.virtualSensor.currentPowerW.toLocaleString("id-ID")} W
              </span>
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

        {/* 3 KPI Cards — Exact Figma 03 · Analisis Energi */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiMetricCard
            icon={<Zap className="size-4" />}
            iconTone="emerald"
            title="Konsumsi Periode Ini"
            source="sensor"
            value={overview.metrics.totalEnergyKwh.toLocaleString("id-ID")}
            unit="kWh"
            trendLabel={`${overview.metrics.idleLossDeltaPct}%`}
            trendDirection={overview.metrics.idleLossDeltaPct <= 0 ? "down" : "up"}
            trendTone={overview.metrics.idleLossDeltaPct <= 0 ? "positive" : "warning"}
            subtitle="vs periode sebelumnya"
          />

          <KpiMetricCard
            icon={<Wallet className="size-4" />}
            iconTone="zinc"
            title="Biaya Periode Ini"
            source="kalkulasi"
            value={formatRupiah(overview.metrics.totalEnergyCostIdr)}
            trendLabel={`ISO ${overview.metrics.operationalEfficiencyPct}%`}
            trendDirection="down"
            trendTone="positive"
            subtitle={`tarif Rp ${overview.workshop.tariffIdrPerKwh.toLocaleString("id-ID")}/kWh`}
          />

          <KpiMetricCard
            icon={<Gauge className="size-4" />}
            iconTone="amber"
            title="Beban Puncak"
            source="prediksi-ml"
            value={peakLoadKw.toLocaleString("id-ID")}
            unit="kW"
            trendLabel="Virtual CT aktif"
            trendDirection="up"
            trendTone="warning"
            subtitle={`meter induk ${overview.virtualSensor.mainMeterPowerW.toLocaleString("id-ID")} W`}
          />
        </section>

        {/* Full-Width Energy Comparison Chart */}
        <EnergyConsumptionCard
          machines={overview.machines}
          totalEnergyKwh={overview.metrics.totalEnergyKwh}
          tariffIdrPerKwh={overview.workshop.tariffIdrPerKwh}
        />

        {/* Bottom 2-Col: Energy Per Machine + AI Insight */}
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
