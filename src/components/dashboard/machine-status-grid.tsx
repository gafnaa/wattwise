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
import { TextMorph } from "torph/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
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
    dotClass: "bg-emerald-400",
    badgeClass: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
    borderHoverClass: "hover:border-emerald-500/40",
  },
  IDLE: {
    label: "IDLE",
    dotClass: "bg-amber-400",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    borderHoverClass: "hover:border-amber-500/45",
  },
  START_UP: {
    label: "START-UP",
    dotClass: "bg-orange-400",
    badgeClass: "border-orange-500/40 bg-orange-500/15 text-orange-300",
    borderHoverClass: "hover:border-orange-500/45",
  },
  OFF: {
    label: "OFF",
    dotClass: "bg-zinc-600",
    badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
    borderHoverClass: "hover:border-zinc-600",
  },
};

const QUADRANT_SHORT: Record<MachineCardData["portfolioQuadrant"], string> = {
  CRITICAL: "Kuadran II • Kritis",
  LEVERAGE_POWER: "Kuadran I • Daya",
  LEVERAGE_TIME: "Kuadran III • Jam",
  NONCRITICAL: "Kuadran IV • Virtual CT",
};

const sparklineChartConfig = {
  powerW: { label: "Daya (W)", color: "#f97316" },
} satisfies ChartConfig;

export function MachineStatusGrid({
  machines,
  searchQuery,
}: MachineStatusGridProps) {
  const [statusTab, setStatusTab] = React.useState<StatusTab>("ALL");
  const [selectedMachine, setSelectedMachine] =
    React.useState<MachineCardData | null>(null);

  const counts = React.useMemo(
    () => ({
      ALL: machines.length,
      WORKING: machines.filter((m) => m.status === "WORKING").length,
      IDLE: machines.filter((m) => m.status === "IDLE").length,
      OFF: machines.filter((m) => m.status === "OFF").length,
    }),
    [machines]
  );

  const filteredMachines = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return machines.filter((machine) => {
      const matchesTab = statusTab === "ALL" || machine.status === statusTab;
      const matchesQuery =
        !q ||
        machine.name.toLowerCase().includes(q) ||
        machine.code.toLowerCase().includes(q);
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
      <Card className="border-border/80 bg-card/90">
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold text-white">
            Daftar Mesin
          </CardTitle>

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

        <CardContent className="space-y-4">
          {filteredMachines.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 p-6 text-center">
              <Power className="mb-2 size-5 text-zinc-500" />
              <p className="text-xs text-zinc-400">Tidak ada mesin cocok.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMachines.map((machine) => {
                const meta = STATUS_META[machine.status];
                const isIdleOver =
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
                    className={`group flex flex-col justify-between rounded-xl border border-border/80 bg-background/65 p-4 text-left transition-all ${meta.borderHoverClass} hover:bg-background/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {machine.name}
                        </h3>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {machine.code}
                        </p>
                      </div>
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${meta.dotClass}`}
                      />
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`h-5 px-2 text-[10px] font-semibold tracking-wider ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </Badge>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                        <Clock className="size-3" />
                        <TextMorph>
                          {formatDuration(machine.sessionDurationSec)}
                        </TextMorph>
                      </span>
                    </div>

                    <div className="mt-3.5 space-y-2 border-t border-border/60 pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-lg font-bold text-white">
                          <TextMorph>
                            {`${machine.currentPowerW.toLocaleString("id-ID")} W`}
                          </TextMorph>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {loadPct}%
                        </span>
                      </div>

                      {isIdleOver ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
                          <AlertCircle className="size-3 shrink-0" />
                          <span>
                            Idle &gt; {machine.idleAlertThresholdMin} mnt •{" "}
                            {formatRupiah(machine.idleLossMonthIdr)}/bln
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>{QUADRANT_SHORT[machine.portfolioQuadrant]}</span>
                          <span className="font-mono">
                            PF {machine.powerFactor.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Compact Virtual CT Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-sky-500/30 bg-sky-950/15 px-4 py-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Cpu className="size-4 text-sky-400" />
              <span className="font-medium text-sky-200">
                Virtual CT (Non-Prioritas)
              </span>
              <span className="hidden font-mono text-[11px] text-zinc-500 sm:inline">
                Induk {VIRTUAL_SENSOR_SUMMARY.mainMeterPowerW.toLocaleString("id-ID")} W − Prioritas{" "}
                {totalPriorityPowerW.toLocaleString("id-ID")} W
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-sky-500/35 bg-sky-500/10 font-mono text-xs text-sky-300"
            >
              <TextMorph>{`${virtualPowerW.toLocaleString("id-ID")} W`}</TextMorph>
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Machine Inspector Modal */}
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
                  <span className="font-mono text-xs text-zinc-500">
                    {selectedMachine.code}
                  </span>
                </div>
                <DialogTitle className="pt-1 text-lg text-white">
                  {selectedMachine.name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Zap className="size-3 text-orange-400" />
                    Daya
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedMachine.currentPowerW.toLocaleString("id-ID")} W
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Gauge className="size-3 text-emerald-400" />
                    PZEM
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedMachine.voltageV} V
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {selectedMachine.currentA} A • PF{" "}
                    {selectedMachine.powerFactor.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Activity className="size-3 text-amber-400" />
                    Rugi Idle
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-amber-300">
                    {formatRupiah(selectedMachine.idleLossMonthIdr)}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-400">
                  Profil Daya (Watt)
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
                      stroke="rgba(148,163,184,0.1)"
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

              <div className="flex justify-end">
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
