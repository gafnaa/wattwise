"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Calendar,
  Database,
  Download,
  Filter,
  LogOut,
  MapPin,
  Radio,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActionLogTable } from "@/components/dashboard/action-log-table";
import { EnergyChartsPanel } from "@/components/dashboard/energy-charts-panel";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { MachineStatusGrid } from "@/components/dashboard/machine-status-grid";
import { WhatIfSimulator } from "@/components/dashboard/what-if-simulator";
import {
  formatRupiah,
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  WORKSHOP_INFO,
  type ActionLogItem,
  type DateRangeKey,
  type MachineCardData,
  type PeriodMetrics,
  type PortfolioQuadrant,
} from "@/lib/mock-dashboard-data";

type QuadrantFilter = "ALL" | PortfolioQuadrant;

export function DashboardShell() {
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const [dateRange, setDateRange] = React.useState<DateRangeKey>("month");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [quadrantFilter, setQuadrantFilter] =
    React.useState<QuadrantFilter>("ALL");
  const [liveSimEnabled, setLiveSimEnabled] = React.useState(true);
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

  // Ambil data dashboard dari API (/api/dashboard/overview) tiap ganti periode
  React.useEffect(() => {
    let active = true;
    fetch(`/api/dashboard/overview?range=${dateRange}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.dataSource) setDataSource(data.dataSource);
        if (data.metrics) setMetrics(data.metrics);
        if (Array.isArray(data.machines) && data.machines.length > 0) {
          setMachines(data.machines);
        }
        if (Array.isArray(data.actionLogs) && data.actionLogs.length > 0) {
          setActionLogs(data.actionLogs);
        }
      })
      .catch(() => {
        if (active) setMetrics(PERIOD_METRICS[dateRange]);
      });

    return () => {
      active = false;
    };
  }, [dateRange]);

  // Shortcut Ctrl+K / Cmd+K untuk fokus ke kolom pencarian
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Simulasi telemetri ringan tiap 3 detik agar status sensor terasa live
  React.useEffect(() => {
    if (!liveSimEnabled) return;

    const timer = window.setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.status === "OFF") {
            return {
              ...m,
              sessionDurationSec: m.sessionDurationSec + 3,
            };
          }
          const base =
            m.status === "WORKING" ? m.baselineWorkingW : m.baselineIdleW;
          const variance = m.status === "WORKING" ? 0.045 : 0.015;
          const factor = 1 + (Math.random() - 0.5) * 2 * variance;
          const nextPowerW = Math.max(0, Math.round(base * factor));
          const nextCurrentA = Number(
            (nextPowerW / (m.voltageV * Math.max(0.3, m.powerFactor))).toFixed(
              1
            )
          );
          return {
            ...m,
            currentPowerW: nextPowerW,
            currentA: nextCurrentA,
            sessionDurationSec: m.sessionDurationSec + 3,
          };
        })
      );
    }, 3000);

    return () => window.clearInterval(timer);
  }, [liveSimEnabled]);

  const visibleMachines = React.useMemo(() => {
    if (quadrantFilter === "ALL") return machines;
    return machines.filter((m) => m.portfolioQuadrant === quadrantFilter);
  }, [machines, quadrantFilter]);

  const idleAlerts = React.useMemo(
    () =>
      machines.filter(
        (m) =>
          m.status === "IDLE" &&
          m.sessionDurationSec >= m.idleAlertThresholdMin * 60
      ),
    [machines]
  );

  async function handleToggleActionStatus(id: string) {
    const target = actionLogs.find((item) => item.id === id);
    if (!target) return;
    const nextStatus =
      target.status === "COMPLETED" ? "PENDING" : "COMPLETED";

    setActionLogs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item
      )
    );

    try {
      await fetch(`/api/recommendations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      // Optimistic update tetap dipertahankan di UI
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  function handleExportCsv() {
    const link = document.createElement("a");
    link.href = `/api/export/audit?range=${dateRange}`;
    link.download = `wattwise-audit-${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="min-h-screen bg-[#080b11] text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-[#0b0f18]/90 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-600/25">
              <Zap className="size-4.5 fill-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-white">
                Smart Audit
              </p>
              <p className="text-[11px] text-muted-foreground">
                WattWise • Sistem Manajemen Energi
              </p>
            </div>
          </div>

          {/* Global Search Bar (Ctrl+K) */}
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari laporan mesin furnitur (Ctrl+K)..."
              className="h-9 rounded-lg border-border/80 bg-background/70 pl-9 pr-14 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-orange-500/60 focus-visible:ring-orange-500/20"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Ctrl K
            </kbd>
          </div>

          {/* Right Controls: Live Sensor Badge + Alerts + Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Telemetry Toggle */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 sm:flex" />
                }
              >
                <span className="relative flex size-2">
                  {liveSimEnabled && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex size-2 rounded-full ${
                      liveSimEnabled ? "bg-emerald-400" : "bg-zinc-500"
                    }`}
                  />
                </span>
                <span className="text-[11px] font-medium text-emerald-300">
                  IoT Sensor {liveSimEnabled ? "Live" : "Paused"}
                </span>
                <Switch
                  checked={liveSimEnabled}
                  onCheckedChange={setLiveSimEnabled}
                  aria-label="Toggle live sensor simulation"
                  className="scale-75 data-checked:bg-emerald-500"
                />
              </TooltipTrigger>
              <TooltipContent>
                {WORKSHOP_INFO.esp32OnlineCount}/{WORKSHOP_INFO.esp32TotalCount}{" "}
                Node ESP32 terhubung • Klik untuk jeda/lanjutkan stream demo
              </TooltipContent>
            </Tooltip>

            {/* Urgent Idle Alerts Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative size-9 border-border/80 bg-background/60 text-zinc-300 hover:bg-muted hover:text-white"
                    aria-label="Notifikasi peringatan daya idle"
                  />
                }
              >
                <Bell className="size-4" />
                {idleAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {idleAlerts.length}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Peringatan Daya Idle (Telegram)</span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300"
                    >
                      {idleAlerts.length} aktif
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {idleAlerts.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Tidak ada mesin melewati ambang batas idle.
                    </div>
                  ) : (
                    idleAlerts.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-semibold text-white">
                            {m.name}
                          </span>
                          <span className="font-mono text-[11px] text-amber-300">
                            {m.currentPowerW} W
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Idle melebihi {m.idleAlertThresholdMin} menit •
                          Potensi rugi {formatRupiah(m.idleLossMonthIdr)}/bln
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex h-9 items-center gap-2.5 rounded-lg px-2 hover:bg-muted/70"
                  />
                }
              >
                <Avatar className="size-7 border border-orange-500/40">
                  <AvatarFallback className="bg-orange-600/20 text-xs font-semibold text-orange-300">
                    PP
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-xs font-semibold text-zinc-100">
                    {WORKSHOP_INFO.ownerName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {WORKSHOP_INFO.ownerRole}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="text-xs font-medium text-white">
                      {WORKSHOP_INFO.ownerName}
                    </p>
                    <p className="text-[11px] font-normal text-muted-foreground">
                      {WORKSHOP_INFO.code} • Tarif{" "}
                      {formatRupiah(WORKSHOP_INFO.tariffIdrPerKwh)}/kWh
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs">
                    <Radio className="mr-2 size-3.5 text-emerald-400" />
                    Status ESP32 ({WORKSHOP_INFO.esp32OnlineCount}/
                    {WORKSHOP_INFO.esp32TotalCount} Online)
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs">
                    <Settings className="mr-2 size-3.5 text-zinc-400" />
                    Tarif &amp; Matrix Portfolio
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                    className="text-xs"
                  >
                    <LogOut className="mr-2 size-3.5" />
                    Keluar ke Login
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6">
        {/* Sub-header Toolbar */}
        <section className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              variant="outline"
              className="border-orange-500/35 bg-orange-500/10 text-[10px] font-semibold tracking-wider text-orange-300 uppercase"
            >
              Lokasi Bengkel
            </Badge>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <MapPin className="size-3.5 text-orange-400" />
              <span>{WORKSHOP_INFO.name}</span>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              • {WORKSHOP_INFO.location}
            </span>
            <Badge
              variant="outline"
              className={
                dataSource === "database"
                  ? "border-emerald-500/35 bg-emerald-500/10 text-[10px] text-emerald-300"
                  : "border-sky-500/35 bg-sky-500/10 text-[10px] text-sky-300"
              }
            >
              <Database className="mr-1 size-3" />
              {dataSource === "database" ? "PostgreSQL Live" : "Mode Demo"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile Search */}
            <div className="relative w-full md:hidden">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari mesin atau rekomendasi..."
                className="h-8 bg-background/70 pl-8 text-xs"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200 hover:bg-muted"
            >
              <Download className="mr-1.5 size-3.5 text-orange-400" />
              Ekspor Data
            </Button>

            {/* Period Selector */}
            <Select
              value={dateRange}
              onValueChange={(val) => {
                if (val) setDateRange(val as DateRangeKey);
              }}
            >
              <SelectTrigger className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200">
                <Calendar className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Bulan Lalu (Okt 2026)</SelectItem>
                <SelectItem value="week">7 Hari Terakhir</SelectItem>
                <SelectItem value="today">Hari Ini (Live)</SelectItem>
              </SelectContent>
            </Select>

            {/* Matrix Energy Portfolio Filter */}
            <Select
              value={quadrantFilter}
              onValueChange={(val) => {
                if (val) setQuadrantFilter(val as QuadrantFilter);
              }}
            >
              <SelectTrigger className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200">
                <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kuadran</SelectItem>
                <SelectItem value="CRITICAL">Kuadran II (Kritis)</SelectItem>
                <SelectItem value="LEVERAGE_POWER">
                  Kuadran I (Daya Tinggi)
                </SelectItem>
                <SelectItem value="LEVERAGE_TIME">
                  Kuadran III (Jam Tinggi)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Row 1: 3 KPI Cards */}
        <KpiCards metrics={metrics} activeIdleMachines={idleAlerts.length} />

        {/* Row 2: Status Mesin (7 cols) + Rasio & Pareto Energi Mesin (5 cols) */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <MachineStatusGrid
              machines={visibleMachines}
              searchQuery={searchQuery}
            />
          </div>
          <div className="xl:col-span-5">
            <EnergyChartsPanel metrics={metrics} machines={visibleMachines} />
          </div>
        </section>

        {/* Row 3: Log Tindakan Otomatisasi (7 cols) + Simulator Hemat "What-If" (5 cols) */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <ActionLogTable
              logs={actionLogs}
              searchQuery={searchQuery}
              onToggleStatus={handleToggleActionStatus}
            />
          </div>
          <div className="xl:col-span-5">
            <WhatIfSimulator
              machines={machines}
              currentIdleLossIdr={metrics.idleLossIdr}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-4 pb-6 text-[11px] text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-emerald-400" />
            <span>
              WattWise Smart Energy Audit • Standar Klasifikasi ISO 14955-5
            </span>
          </div>
          <span>
            Tarif Listrik Aktif:{" "}
            <strong className="font-mono text-zinc-300">
              {formatRupiah(WORKSHOP_INFO.tariffIdrPerKwh)} / kWh
            </strong>
          </span>
        </footer>
      </main>
    </div>
  );
}
