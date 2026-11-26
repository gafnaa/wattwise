"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Cpu,
  Download,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "skullet/react";
import { TextMorph } from "torph/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { EnergyChartsPanel } from "@/components/dashboard/energy-charts-panel";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import {
  formatRupiah,
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  type ActionLogItem,
  type DateRangeKey,
  type MachineCardData,
  type PeriodMetrics,
} from "@/lib/mock-dashboard-data";

export function DashboardShell() {
  const [dateRange, setDateRange] = React.useState<DateRangeKey>("month");
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "demo"
  );
  const [metrics, setMetrics] = React.useState<PeriodMetrics>(
    PERIOD_METRICS.month
  );
  const [machines, setMachines] =
    React.useState<MachineCardData[]>(INITIAL_MACHINES);
  const [actionLogs, setActionLogs] =
    React.useState<ActionLogItem[]>(INITIAL_ACTION_LOGS);

  React.useEffect(() => {
    let active = true;

    fetch(`/api/dashboard/overview?range=${dateRange}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.dataSource) setDataSource(data.dataSource);
        if (data?.metrics) setMetrics(data.metrics);
        if (Array.isArray(data?.machines) && data.machines.length > 0) {
          setMachines(data.machines);
        }
        if (Array.isArray(data?.actionLogs) && data.actionLogs.length > 0) {
          setActionLogs(data.actionLogs);
        }
      })
      .catch(() => {
        if (active) setMetrics(PERIOD_METRICS[dateRange]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dateRange]);

  const idleCount = machines.filter((m) => m.status === "IDLE").length;
  const workingCount = machines.filter((m) => m.status === "WORKING").length;
  const pendingActions = actionLogs.filter((a) => a.status === "PENDING");
  const pendingSavings = pendingActions.reduce(
    (sum, a) => sum + a.estimatedSavingIdr,
    0
  );

  function handleExportCsv() {
    const link = document.createElement("a");
    link.href = `/api/export/audit?range=${dateRange}`;
    link.download = `wattwise-audit-${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <AppShell
      title="Ringkasan"
      dataSource={dataSource}
      actions={
        <>
          <Select
            value={dateRange}
            onValueChange={(val) => {
              if (val && val !== dateRange) {
                setLoading(true);
                setDateRange(val as DateRangeKey);
              }
            }}
          >
            <SelectTrigger className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200">
              <Calendar className="mr-1.5 size-3.5 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">30 Hari</SelectItem>
              <SelectItem value="week">7 Hari</SelectItem>
              <SelectItem value="today">Hari Ini</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200"
          >
            <Download className="mr-1.5 size-3.5 text-orange-400" />
            <span className="hidden sm:inline">Ekspor</span>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* KPI Summary dengan Skullet smart skeleton */}
        <Skeleton loading={loading} id="overview-kpis" label="Memuat KPI">
          <KpiCards metrics={metrics} />
        </Skeleton>

        {/* Charts */}
        <Skeleton loading={loading} id="overview-charts" label="Memuat grafik">
          <EnergyChartsPanel metrics={metrics} machines={machines} />
        </Skeleton>

        {/* Business Flow Shortcuts -> /machines & /actions */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-border/80 bg-card/90 transition-colors hover:border-amber-500/40">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    <TextMorph>
                      {`${idleCount} mesin idle • ${workingCount} aktif`}
                    </TextMorph>
                  </p>
                  <p className="text-xs text-zinc-500">
                    Pantau status mesin &amp; Virtual CT live
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/machines" />}
                className="shrink-0 border-border/80 text-xs"
              >
                Mesin
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90 transition-colors hover:border-emerald-500/40">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    <TextMorph>
                      {`${pendingActions.length} aksi menunggu • ${formatRupiah(pendingSavings)}`}
                    </TextMorph>
                  </p>
                  <p className="text-xs text-zinc-500">
                    Simulasi What-If &amp; kirim laporan Telegram
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/actions" />}
                className="shrink-0 border-border/80 text-xs"
              >
                Hemat &amp; Aksi
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
