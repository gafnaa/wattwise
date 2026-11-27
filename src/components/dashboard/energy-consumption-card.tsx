"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Cpu } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataSourceBadge } from "@/components/ui/wattwise-badges";
import type {
  EnergyTimeseriesPoint,
  TimeseriesGranularity,
} from "@/lib/audit/timeseries";
import { formatRupiah, type MachineCardData } from "@/lib/mock-dashboard-data";

interface TimeseriesApiResponse {
  dataSource: "database" | "demo";
  granularity: TimeseriesGranularity;
  machineCode: string;
  tariffIdrPerKwh: number;
  hasPreviousData?: boolean;
  series: EnergyTimeseriesPoint[];
}

function buildFallbackSeries(params: {
  granularity: TimeseriesGranularity;
  totalKwh: number;
  tariffIdrPerKwh: number;
  machineScale: number;
}): EnergyTimeseriesPoint[] {
  const { granularity, totalKwh, tariffIdrPerKwh, machineScale } = params;
  const scaledTotal = Math.max(12, totalKwh * machineScale);

  if (granularity === "weekly") {
    const factors = [0.92, 1.04, 0.96, 1.08];
    const prevFactors = [0.98, 1.09, 1.01, 1.03];
    const base = scaledTotal / 4;
    return factors.map((f, idx) => {
      const currentKwh = Number((base * f).toFixed(1));
      const previousKwh = Number((base * prevFactors[idx]).toFixed(1));
      return {
        bucketKey: `week-${idx + 1}`,
        label: `Minggu ${idx + 1}`,
        fullDate: `Minggu ke-${idx + 1} · Periode Aktif`,
        currentKwh,
        previousKwh,
        workingKwh: Number((currentKwh * 0.78).toFixed(1)),
        idleKwh: Number((currentKwh * 0.2).toFixed(1)),
        estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
      };
    });
  }

  if (granularity === "monthly") {
    const months = ["Jun", "Jul", "Agu", "Sep", "Okt", "Nov"];
    const factors = [0.94, 1.02, 1.06, 0.97, 1.05, 1.0];
    const prevFactors = [0.99, 1.05, 1.08, 1.02, 1.07, 1.06];
    return months.map((m, idx) => {
      const currentKwh = Number((scaledTotal * factors[idx]).toFixed(1));
      const previousKwh = Number((scaledTotal * prevFactors[idx]).toFixed(1));
      return {
        bucketKey: `month-${idx + 1}`,
        label: m,
        fullDate: `Bulan ${m} 2026`,
        currentKwh,
        previousKwh,
        workingKwh: Number((currentKwh * 0.78).toFixed(1)),
        idleKwh: Number((currentKwh * 0.2).toFixed(1)),
        estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
      };
    });
  }

  const dailyFactors = [
    1.05, 1.11, 1.16, 0.86, 0.36, 1.14, 1.18, 1.15, 1.07, 1.22, 1.04, 0.51,
    1.12, 1.08,
  ];
  const prevDailyFactors = [
    0.99, 1.14, 1.09, 1.05, 0.42, 1.08, 1.13, 1.2, 1.04, 1.14, 1.09, 0.59,
    1.15, 1.12,
  ];
  const dayLabels = [
    "14 Nov",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27 Nov",
  ];
  const dailyBase = Math.max(18, scaledTotal / 26);

  return dailyFactors.map((f, idx) => {
    const currentKwh = Number((dailyBase * f).toFixed(1));
    const previousKwh = Number((dailyBase * prevDailyFactors[idx]).toFixed(1));
    return {
      bucketKey: `day-${idx + 1}`,
      label: dayLabels[idx] ?? `H-${dailyFactors.length - idx}`,
      fullDate: `Hari ${dayLabels[idx] ?? idx + 1}`,
      currentKwh,
      previousKwh,
      workingKwh: Number((currentKwh * 0.78).toFixed(1)),
      idleKwh: Number((currentKwh * 0.2).toFixed(1)),
      estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
    };
  });
}

function subscribeNoop() {
  return () => {};
}

export function EnergyConsumptionCard({
  machines,
  totalEnergyKwh,
  tariffIdrPerKwh,
}: {
  machines: MachineCardData[];
  totalEnergyKwh: number;
  tariffIdrPerKwh: number;
}) {
  const isClient = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [granularity, setGranularity] =
    React.useState<TimeseriesGranularity>("daily");
  const [selectedMachine, setSelectedMachine] = React.useState<string>("ALL");
  const [comparePeriod, setComparePeriod] = React.useState<boolean>(true);
  const [dbSeries, setDbSeries] = React.useState<EnergyTimeseriesPoint[] | null>(
    null
  );
  const [hasDbPrevious, setHasDbPrevious] = React.useState<boolean>(true);
  const [seriesSource, setSeriesSource] = React.useState<"database" | "demo">(
    "demo"
  );

  React.useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      granularity,
      machineCode: selectedMachine,
    });
    fetch(`/api/analytics/timeseries?${params.toString()}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? (res.json() as Promise<TimeseriesApiResponse>) : null))
      .then((payload) => {
        if (!active || !payload) return;
        if (payload.dataSource === "database" && payload.series.length > 0) {
          setDbSeries(payload.series);
          setHasDbPrevious(Boolean(payload.hasPreviousData));
          setSeriesSource("database");
        } else {
          setDbSeries(null);
          setSeriesSource("demo");
        }
      })
      .catch(() => {
        if (active) setDbSeries(null);
      });

    return () => {
      active = false;
    };
  }, [granularity, selectedMachine]);

  const totalRatedW = React.useMemo(
    () => machines.reduce((s, m) => s + m.ratedPowerW, 0) || 1,
    [machines]
  );

  const machineScale = React.useMemo(() => {
    if (selectedMachine === "ALL") return 1;
    const found = machines.find((m) => m.code === selectedMachine);
    return found ? Math.max(0.08, found.ratedPowerW / totalRatedW) : 1;
  }, [machines, selectedMachine, totalRatedW]);

  const series = React.useMemo(() => {
    if (dbSeries && dbSeries.length > 0) return dbSeries;
    return buildFallbackSeries({
      granularity,
      totalKwh: totalEnergyKwh,
      tariffIdrPerKwh,
      machineScale,
    });
  }, [dbSeries, granularity, machineScale, tariffIdrPerKwh, totalEnergyKwh]);

  const showComparisonLine =
    comparePeriod && (seriesSource === "demo" || hasDbPrevious);

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Konsumsi Energi
            </h2>
            <DataSourceBadge kind="sensor" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {seriesSource === "database"
              ? "Agregasi aktual Supabase"
              : "Estimasi konsumsi"}{" "}
            ·{" "}
            {selectedMachine === "ALL"
              ? "seluruh mesin"
              : machines.find((m) => m.code === selectedMachine)?.name ??
                "mesin"}{" "}
            per{" "}
            {granularity === "daily"
              ? "hari"
              : granularity === "weekly"
                ? "minggu"
                : "bulan"}{" "}
            (kWh)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
            {(
              [
                ["daily", "Harian"],
                ["weekly", "Mingguan"],
                ["monthly", "Bulanan"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGranularity(key)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  granularity === key
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Select
            value={selectedMachine}
            onValueChange={(v) => setSelectedMachine(v ?? "ALL")}
          >
            <SelectTrigger className="h-8 w-[144px] rounded-lg border-border bg-card text-xs font-medium">
              <Cpu className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Mesin</SelectItem>
              {machines.map((m) => (
                <SelectItem key={m.code} value={m.code}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-[#059669]" />
            <span>Periode ini</span>
          </span>
          {showComparisonLine && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 border-t-2 border-dashed border-zinc-400" />
              <span>Periode sebelumnya</span>
            </span>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={comparePeriod}
            onCheckedChange={(checked) => setComparePeriod(Boolean(checked))}
          />
          <span>Bandingkan periode</span>
        </label>
      </div>

      <div className="mt-4 h-[230px] w-full min-w-0 sm:h-[265px]">
        {isClient ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="wwEmeraldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as EnergyTimeseriesPoint;
                  return (
                    <div className="min-w-[205px] rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
                      <p className="font-semibold text-foreground">
                        {row.fullDate}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-[#059669]" />
                            Total periode ini
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            {row.currentKwh.toLocaleString("id-ID")} kWh
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
                          <span>Working / Idle</span>
                          <span className="font-mono">
                            {row.workingKwh.toLocaleString("id-ID")} /{" "}
                            {row.idleKwh.toLocaleString("id-ID")} kWh
                          </span>
                        </div>
                        {showComparisonLine && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-1.5 rounded-full bg-zinc-400" />
                              Sebelumnya
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {row.previousKwh.toLocaleString("id-ID")} kWh
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-4 border-t border-border pt-1.5">
                          <span className="text-muted-foreground">
                            Est. biaya
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatRupiah(row.estCostIdr)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {showComparisonLine && (
                <Area
                  type="monotone"
                  dataKey="previousKwh"
                  stroke="#A1A1AA"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="currentKwh"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#wwEmeraldFill)"
                activeDot={{
                  r: 5,
                  fill: "#059669",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-muted/40" />
        )}
      </div>
    </div>
  );
}
