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
import { TextMorph } from "torph/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  lossIdr: { label: "Kerugian Idle", color: "#f97316" },
} satisfies ChartConfig;

const PARETO_COLORS = [
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
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Proporsi Daya (Donut) */}
      <Card className="border-border/80 bg-card/90 lg:col-span-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white">
            Proporsi Daya
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
          <div className="relative flex items-center justify-center">
            <ChartContainer
              config={isoChartConfig}
              className="aspect-square h-[190px] w-[190px]"
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
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {metrics.isoDistribution.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold text-white">
                <TextMorph>{`${metrics.operationalEfficiencyPct}%`}</TextMorph>
              </span>
              <span className="text-[10px] text-zinc-500">ISO 14955-5</span>
            </div>
          </div>

          <div className="w-full max-w-[180px] space-y-2.5">
            {metrics.isoDistribution.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <span className="font-mono text-zinc-400">{item.pct}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mesin Terboros (Pareto) */}
      <Card className="border-border/80 bg-card/90 lg:col-span-7">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-white">
            Mesin Terboros (Pareto Idle)
          </CardTitle>
          <span className="font-mono text-[11px] text-zinc-500">Rupiah</span>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={paretoChartConfig}
            className="h-[220px] w-full"
          >
            <BarChart
              data={paretoData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.1)"
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(val: number) =>
                  val >= 1_000_000
                    ? `${(val / 1_000_000).toFixed(1)}jt`
                    : `${Math.round(val / 1_000)}rb`
                }
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={96}
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
                        <p className="text-[11px] text-zinc-300">
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
              <Bar dataKey="lossIdr" radius={[0, 6, 6, 0]} barSize={18}>
                {paretoData.map((entry, idx) => (
                  <Cell
                    key={entry.shortName}
                    fill={PARETO_COLORS[idx % PARETO_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  );
}
