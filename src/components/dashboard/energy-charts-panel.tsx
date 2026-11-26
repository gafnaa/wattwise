"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatRupiah,
  type MachineCardData,
  type PeriodMetrics,
} from "@/lib/mock-dashboard-data";

interface EnergyChartsPanelProps {
  metrics: PeriodMetrics;
  machines: MachineCardData[];
}

const isoChartConfig = {
  working: { label: "Working", color: "#10b981" },
  idle: { label: "Idle", color: "#f59e0b" },
  startup: { label: "Start-up", color: "#f97316" },
} satisfies ChartConfig;

const paretoChartConfig = {
  lossIdr: {
    label: "Biaya Kerugian Idle",
    color: "#f97316",
  },
} satisfies ChartConfig;

const PARETO_BAR_COLORS = [
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#38bdf8",
  "#64748b",
];

export function EnergyChartsPanel({
  metrics,
  machines,
}: EnergyChartsPanelProps) {
  const paretoData = React.useMemo(() => {
    return [...machines]
      .sort((a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr)
      .map((m) => ({
        shortName: m.name
          .replace(" Sliding", "")
          .replace(" Auto", "")
          .replace(" 1325", "")
          .replace(" (Boring)", ""),
        fullName: m.name,
        lossIdr: Math.round(m.idleLossMonthIdr * metrics.paretoScale),
      }));
  }, [machines, metrics.paretoScale]);

  return (
    <Card className="flex h-full flex-col border-border/80 bg-card/90 shadow-lg shadow-black/25">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white">
          Rasio &amp; Pareto Energi Mesin
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Proporsi status ISO 14955-5 dan peringkat mesin penyumbang biaya idle
        </CardDescription>
      </CardHeader>

      <CardContent className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-12">
        {/* Donut Chart: Proporsi Daya (Status ISO) */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-background/50 p-3.5 sm:col-span-5">
          <p className="text-xs font-medium text-zinc-300">
            Proporsi Daya (Status ISO)
          </p>

          <div className="relative my-1 flex items-center justify-center">
            <ChartContainer
              config={isoChartConfig}
              className="aspect-square h-[168px] w-[168px]"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-semibold text-white">
                            {value}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={metrics.isoDistribution}
                  dataKey="pct"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {metrics.isoDistribution.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-xl font-bold text-white">
                {metrics.operationalEfficiencyPct}%
              </span>
              <span className="text-[10px] text-zinc-400">Efisiensi</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            {metrics.isoDistribution.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <span className="font-mono text-zinc-400">
                  {item.pct}% ({item.kwh} kWh)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Horizontal Bar Chart: Mesin Paling Boros (Pareto) */}
        <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-background/50 p-3.5 sm:col-span-7">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-300">
              Mesin Paling Boros (Pareto)
            </p>
            <span className="text-[10px] text-zinc-500">
              Biaya Kerugian Idle (Rp)
            </span>
          </div>

          <ChartContainer
            config={paretoChartConfig}
            className="h-[225px] w-full"
          >
            <BarChart
              data={paretoData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.12)"
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickFormatter={(val: number) =>
                  val >= 1_000_000
                    ? `${(val / 1_000_000).toFixed(1)}jt`
                    : `${Math.round(val / 1_000)}rb`
                }
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={94}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium text-zinc-200">
                          {item?.payload?.fullName}
                        </p>
                        <p className="font-mono text-xs font-semibold text-amber-300">
                          {formatRupiah(Number(value))}
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="lossIdr" radius={[0, 6, 6, 0]} barSize={16}>
                {paretoData.map((entry, idx) => (
                  <Cell
                    key={entry.shortName}
                    fill={PARETO_BAR_COLORS[idx % PARETO_BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
