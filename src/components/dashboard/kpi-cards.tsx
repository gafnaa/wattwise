"use client";

import {
  AlertTriangle,
  Gauge,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatRupiah,
  type PeriodMetrics,
} from "@/lib/mock-dashboard-data";

interface KpiCardsProps {
  metrics: PeriodMetrics;
  activeIdleMachines: number;
}

export function KpiCards({ metrics, activeIdleMachines }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* KPI 1: Estimasi Kerugian Daya Idle */}
      <Card className="relative overflow-hidden border-border/80 bg-card/90 shadow-lg shadow-black/25">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl"
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
            Estimasi Kerugian Daya Idle
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-400">
            <AlertTriangle className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {formatRupiah(metrics.idleLossIdr)}
            </p>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-400"
            >
              <TrendingDown className="mr-1 size-3" />
              {Math.abs(metrics.idleLossDeltaPct)}%
            </Badge>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 shrink-0 rounded-full bg-amber-400" />
            <span>
              Terbesar akibat{" "}
              <strong className="font-medium text-zinc-200">
                {metrics.topWasteMachine}
              </strong>
              {activeIdleMachines > 0
                ? ` (${activeIdleMachines} mesin sedang idle)`
                : ""}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* KPI 2: Efisiensi Daya Operasional (ISO 14955-5) */}
      <Card className="relative overflow-hidden border-border/80 bg-card/90 shadow-lg shadow-black/25">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl"
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
            Efisiensi Daya Operasional
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Gauge className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-3">
            <p className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {metrics.operationalEfficiencyPct}%
            </p>
            <Badge className="border border-emerald-500/35 bg-emerald-500/15 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20">
              {metrics.efficiencyBadge}
            </Badge>
          </div>
          <Progress
            value={metrics.operationalEfficiencyPct}
            className="h-1.5 bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-emerald-500 [&_[data-slot=progress-indicator]]:to-teal-400"
          />
          <p className="text-xs text-muted-foreground">
            Rasio energi produktif berbasis{" "}
            <strong className="font-medium text-zinc-200">
              Standar ISO 14955-5
            </strong>
          </p>
        </CardContent>
      </Card>

      {/* KPI 3: Total Konsumsi Energi */}
      <Card className="relative overflow-hidden border-border/80 bg-card/90 shadow-lg shadow-black/25">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl"
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
            Total Konsumsi Energi
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/10 text-orange-400">
            <Zap className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {metrics.totalEnergyKwh.toLocaleString("id-ID")}{" "}
              <span className="text-base font-semibold text-zinc-400">kWh</span>
            </p>
            <span className="font-mono text-xs font-medium text-zinc-300">
              ({formatRupiah(metrics.totalEnergyCostIdr)})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Terpantau via{" "}
            <strong className="font-medium text-zinc-200">
              Meter Induk &amp; Virtual CT
            </strong>{" "}
            ({metrics.virtualSensorShareKwh} kWh non-prioritas)
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
