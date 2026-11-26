"use client";

import { AlertTriangle, Gauge, TrendingDown, Zap } from "lucide-react";
import { TextMorph } from "torph/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatRupiah, type PeriodMetrics } from "@/lib/mock-dashboard-data";

interface KpiCardsProps {
  metrics: PeriodMetrics;
}

export function KpiCards({ metrics }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* KPI 1: Kerugian Idle */}
      <Card className="border-border/80 bg-card/90">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Kerugian Idle
            </span>
            <AlertTriangle className="size-4 text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-2xl font-bold tracking-tight text-white">
              <TextMorph>{formatRupiah(metrics.idleLossIdr)}</TextMorph>
            </p>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-400"
            >
              <TrendingDown className="mr-1 size-3" />
              <TextMorph>{`${Math.abs(metrics.idleLossDeltaPct)}%`}</TextMorph>
            </Badge>
          </div>
          <p className="truncate text-xs text-zinc-500">
            Tertinggi: <span className="text-zinc-300">{metrics.topWasteMachine}</span>
          </p>
        </CardContent>
      </Card>

      {/* KPI 2: Efisiensi */}
      <Card className="border-border/80 bg-card/90">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Efisiensi Daya
            </span>
            <Gauge className="size-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2.5">
            <p className="font-mono text-2xl font-bold tracking-tight text-white">
              <TextMorph>{`${metrics.operationalEfficiencyPct}%`}</TextMorph>
            </p>
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-[11px] text-emerald-300">
              <TextMorph>{metrics.efficiencyBadge}</TextMorph>
            </Badge>
          </div>
          <Progress
            value={metrics.operationalEfficiencyPct}
            className="h-1.5 bg-zinc-800 [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
        </CardContent>
      </Card>

      {/* KPI 3: Total Energi */}
      <Card className="border-border/80 bg-card/90">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Total Energi
            </span>
            <Zap className="size-4 text-orange-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-2xl font-bold tracking-tight text-white">
              <TextMorph>
                {`${metrics.totalEnergyKwh.toLocaleString("id-ID")} kWh`}
              </TextMorph>
            </p>
            <span className="font-mono text-xs text-zinc-400">
              <TextMorph>{formatRupiah(metrics.totalEnergyCostIdr)}</TextMorph>
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Virtual CT:{" "}
            <span className="font-mono text-zinc-300">
              {metrics.virtualSensorShareKwh} kWh
            </span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
