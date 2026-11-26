"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  Cpu,
  Gauge,
  Power,
  Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDuration,
  formatRupiah,
  VIRTUAL_SENSOR_SUMMARY,
  type MachineCardData,
  type MachineStatus,
} from "@/lib/mock-dashboard-data";

type StatusTab = "ALL" | "WORKING" | "IDLE" | "OFF";

interface MachineStatusGridProps {
  machines: MachineCardData[];
  searchQuery: string;
}

const STATUS_META: Record<
  MachineStatus,
  {
    label: string;
    dotClass: string;
    badgeClass: string;
    borderHoverClass: string;
  }
> = {
  WORKING: {
    label: "WORKING",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    badgeClass: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
    borderHoverClass: "hover:border-emerald-500/40",
  },
  IDLE: {
    label: "IDLE",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.85)]",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    borderHoverClass: "hover:border-amber-500/45",
  },
  START_UP: {
    label: "START-UP",
    dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.85)]",
    badgeClass: "border-orange-500/40 bg-orange-500/15 text-orange-300",
    borderHoverClass: "hover:border-orange-500/45",
  },
  OFF: {
    label: "OFF",
    dotClass: "bg-zinc-500",
    badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
    borderHoverClass: "hover:border-zinc-600",
  },
};

const QUADRANT_LABELS: Record<MachineCardData["portfolioQuadrant"], string> = {
  CRITICAL: "Kuadran II • Critical Machine",
  LEVERAGE_POWER: "Kuadran I • Leverage Power",
  LEVERAGE_TIME: "Kuadran III • Leverage Time",
  NONCRITICAL: "Kuadran IV • Virtual CT",
};

const sparklineChartConfig = {
  powerW: {
    label: "Daya Aktif (W)",
    color: "#f97316",
  },
} satisfies ChartConfig;

export function MachineStatusGrid({
  machines,
  searchQuery,
}: MachineStatusGridProps) {
  const [statusTab, setStatusTab] = React.useState<StatusTab>("ALL");
  const [selectedMachine, setSelectedMachine] =
    React.useState<MachineCardData | null>(null);

  const counts = React.useMemo(() => {
    return {
      ALL: machines.length,
      WORKING: machines.filter((m) => m.status === "WORKING").length,
      IDLE: machines.filter((m) => m.status === "IDLE").length,
      OFF: machines.filter((m) => m.status === "OFF").length,
    };
  }, [machines]);

  const filteredMachines = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return machines.filter((machine) => {
      const matchesTab = statusTab === "ALL" || machine.status === statusTab;
      const matchesQuery =
        !q ||
        machine.name.toLowerCase().includes(q) ||
        machine.code.toLowerCase().includes(q) ||
        machine.categoryLabel.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [machines, statusTab, searchQuery]);

  const totalPriorityPowerW = React.useMemo(
    () => machines.reduce((sum, m) => sum + m.currentPowerW, 0),
    [machines]
  );

  const virtualPowerW = Math.max(
    0,
    VIRTUAL_SENSOR_SUMMARY.mainMeterPowerW - totalPriorityPowerW
  );

  return (
    <>
      <Card className="flex h-full flex-col border-border/80 bg-card/90 shadow-lg shadow-black/25">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Status Mesin
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Klasifikasi real-time Random Forest (ISO 14955-5) • Klik kartu
              untuk rincian daya
            </CardDescription>
          </div>

          <Tabs
            value={statusTab}
            onValueChange={(val) => setStatusTab(String(val) as StatusTab)}
          >
            <TabsList className="h-8 bg-background/80 p-0.5">
              <TabsTrigger value="ALL" className="px-2.5 text-xs">
                Semua ({counts.ALL})
              </TabsTrigger>
              <TabsTrigger value="WORKING" className="px-2.5 text-xs">
                Working ({counts.WORKING})
              </TabsTrigger>
              <TabsTrigger value="IDLE" className="px-2.5 text-xs">
                Idle ({counts.IDLE})
              </TabsTrigger>
              <TabsTrigger value="OFF" className="px-2.5 text-xs">
                Off ({counts.OFF})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          {filteredMachines.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 p-6 text-center">
              <Power className="mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-zinc-200">
                Tidak ada mesin yang cocok
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ubah filter status atau kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMachines.map((machine) => {
                const meta = STATUS_META[machine.status];
                const isIdleOverThreshold =
                  machine.status === "IDLE" &&
                  machine.sessionDurationSec >=
                    machine.idleAlertThresholdMin * 60;
                const loadPct = Math.min(
                  100,
                  Math.round((machine.currentPowerW / machine.ratedPowerW) * 100)
                );

                return (
                  <button
                    key={machine.id}
                    type="button"
                    onClick={() => setSelectedMachine(machine)}
                    className={`group flex flex-col justify-between rounded-xl border border-border/80 bg-background/65 p-3.5 text-left transition-all ${meta.borderHoverClass} hover:bg-background/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-zinc-100 group-hover:text-white">
                            {machine.name}
                          </h3>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {machine.categoryLabel}
                          </p>
                        </div>
                        <span
                          className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${meta.dotClass}`}
                          title={meta.label}
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`h-5 px-2 text-[10px] font-semibold tracking-wider ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </Badge>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                          <Clock className="size-3" />
                          {formatDuration(machine.sessionDurationSec)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-base font-bold text-white">
                          {machine.currentPowerW.toLocaleString("id-ID")}{" "}
                          <span className="text-[11px] font-normal text-zinc-400">
                            W
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {loadPct}% beban
                        </span>
                      </div>

                      {isIdleOverThreshold ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
                          <AlertCircle className="size-3 shrink-0" />
                          <span>
                            Idle &gt; {machine.idleAlertThresholdMin} mnt •
                            Rugi {formatRupiah(machine.idleLossMonthIdr)}/bln
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span className="font-mono">{machine.deviceUid}</span>
                          <span>PF {machine.powerFactor.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Virtual Sensor Summary Strip */}
          <div className="flex flex-col justify-between gap-2 rounded-xl border border-dashed border-sky-500/30 bg-sky-950/15 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
                <Cpu className="size-3.5" />
              </div>
              <div>
                <p className="font-medium text-sky-200">
                  {VIRTUAL_SENSOR_SUMMARY.name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Estimasi agregat mesin Kuadran IV: P_induk (
                  {VIRTUAL_SENSOR_SUMMARY.mainMeterPowerW.toLocaleString(
                    "id-ID"
                  )}{" "}
                  W) − Σ Prioritas (
                  {totalPriorityPowerW.toLocaleString("id-ID")} W)
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-sky-500/35 bg-sky-500/10 font-mono text-xs font-semibold text-sky-300"
            >
              {virtualPowerW.toLocaleString("id-ID")} W
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Machine Detail Inspector Dialog */}
      <Dialog
        open={Boolean(selectedMachine)}
        onOpenChange={(open) => {
          if (!open) setSelectedMachine(null);
        }}
      >
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-lg">
          {selectedMachine && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={STATUS_META[selectedMachine.status].badgeClass}
                  >
                    {STATUS_META[selectedMachine.status].label}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedMachine.code} • {selectedMachine.deviceUid}
                  </span>
                </div>
                <DialogTitle className="pt-1 text-lg text-white">
                  {selectedMachine.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedMachine.categoryLabel} •{" "}
                  {QUADRANT_LABELS[selectedMachine.portfolioQuadrant]}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Zap className="size-3 text-orange-400" />
                    Daya Aktual
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedMachine.currentPowerW.toLocaleString("id-ID")} W
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Rated {selectedMachine.ratedPowerW.toLocaleString("id-ID")}{" "}
                    W
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Gauge className="size-3 text-emerald-400" />
                    Listrik PZEM
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedMachine.voltageV} V
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {selectedMachine.currentA} A • PF{" "}
                    {selectedMachine.powerFactor.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Activity className="size-3 text-amber-400" />
                    Rugi Idle / Bln
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-amber-300">
                    {formatRupiah(selectedMachine.idleLossMonthIdr)}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {selectedMachine.idleHoursMonth} jam idle/bln
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-300">
                  Kurva Profil Daya Terkini (Watt)
                </p>
                <ChartContainer
                  config={sparklineChartConfig}
                  className="h-[170px] w-full"
                >
                  <AreaChart
                    data={selectedMachine.sparkline}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="machinePowerFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f97316"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f97316"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-semibold text-white">
                              {Number(value).toLocaleString("id-ID")} W
                            </span>
                          )}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="powerW"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="url(#machinePowerFill)"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Ambang Alert Idle:{" "}
                  <strong className="text-zinc-200">
                    {selectedMachine.idleAlertThresholdMin} menit
                  </strong>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedMachine(null)}
                >
                  Tutup
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
