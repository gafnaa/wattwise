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
import {
  formatRupiah,
  type MachineCardData,
} from "@/lib/mock-dashboard-data";

type Granularity = "daily" | "weekly" | "monthly";

interface ChartPoint {
  label: string;
  fullDate: string;
  currentKwh: number;
  previousKwh: number;
  estCostIdr: number;
}

function buildEnergySeries(params: {
  granularity: Granularity;
  totalKwh: number;
  tariffIdrPerKwh: number;
  machineScale: number;
}): ChartPoint[] {
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
        label: `Minggu ${idx + 1}`,
        fullDate: `Minggu ke-${idx + 1} · Periode Aktif`,
        currentKwh,
        previousKwh,
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
        label: m,
        fullDate: `Bulan ${m} 2026`,
        currentKwh,
        previousKwh,
        estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
      };
    });
  }

  // Harian (14 hari terakhir, Minggu turun karena bengkel libur)
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
  const fullDates = [
    "Sabtu, 14 Nov 2026",
    "Minggu, 15 Nov 2026",
    "Senin, 16 Nov 2026",
    "Selasa, 17 Nov 2026",
    "Rabu, 18 Nov 2026",
    "Kamis, 19 Nov 2026",
    "Jumat, 20 Nov 2026",
    "Sabtu, 21 Nov 2026",
    "Minggu, 22 Nov 2026",
    "Senin, 23 Nov 2026",
    "Selasa, 24 Nov 2026",
    "Rabu, 25 Nov 2026",
    "Kamis, 26 Nov 2026",
    "Jumat, 27 Nov 2026",
  ];
  const dailyBase = Math.max(18, scaledTotal / 26);

  return dailyFactors.map((f, idx) => {
    const currentKwh = Number((dailyBase * f).toFixed(1));
    const previousKwh = Number((dailyBase * prevDailyFactors[idx]).toFixed(1));
    return {
      label: dayLabels[idx] ?? `H-${dailyFactors.length - idx}`,
      fullDate: fullDates[idx] ?? `Hari ke-${idx + 1}`,
      currentKwh,
      previousKwh,
      estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
    };
  });
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
  const [granularity, setGranularity] = React.useState<Granularity>("daily");
  const [selectedMachine, setSelectedMachine] = React.useState<string>("ALL");
  const [comparePeriod, setComparePeriod] = React.useState<boolean>(true);

  const totalRatedW = React.useMemo(
    () => machines.reduce((s, m) => s + m.ratedPowerW, 0) || 1,
    [machines]
  );

  const machineScale = React.useMemo(() => {
    if (selectedMachine === "ALL") return 1;
    const found = machines.find((m) => m.code === selectedMachine);
    return found ? Math.max(0.08, found.ratedPowerW / totalRatedW) : 1;
  }, [machines, selectedMachine, totalRatedW]);

  const series = React.useMemo(
    () =>
      buildEnergySeries({
        granularity,
        totalKwh: totalEnergyKwh,
        tariffIdrPerKwh,
        machineScale,
      }),
    [granularity, machineScale, tariffIdrPerKwh, totalEnergyKwh]
  );

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Konsumsi Energi
            </h2>
            <DataSourceBadge kind="sensor" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Total konsumsi{" "}
            {selectedMachine === "ALL"
              ? "seluruh mesin"
              : machines.find((m) => m.code === selectedMachine)?.name ?? "mesin"}{" "}
            per{" "}
            {granularity === "daily"
              ? "hari"
              : granularity === "weekly"
                ? "minggu"
                : "bulan"}{" "}
            (kWh)
          </p>
        </div>

        {/* Right Controls */}
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
            <SelectTrigger className="h-8 w-[150px] rounded-lg border-border bg-card text-xs font-medium">
              <Cpu className="mr-1.5 size-3.5 text-muted-foreground" />
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

      {/* Legend + Compare Toggle */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-[#059669]" />
            <span>Periode ini</span>
          </span>
          {comparePeriod && (
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

      {/* Chart */}
      <div className="mt-4 h-[265px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={series}
            margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="wwEmeraldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
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
                const row = payload[0]?.payload as ChartPoint;
                return (
                  <div className="min-w-[190px] rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
                    <p className="font-semibold text-foreground">
                      {row.fullDate}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-[#059669]" />
                          Periode ini
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {row.currentKwh.toLocaleString("id-ID")} kWh
                        </span>
                      </div>
                      {comparePeriod && (
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
                        <span className="text-muted-foreground">Est. biaya</span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatRupiah(row.estCostIdr)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {comparePeriod && (
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
              activeDot={{ r: 5, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
