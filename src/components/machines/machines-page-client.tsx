"use client";

import * as React from "react";
import { Filter, Search } from "lucide-react";
import { Skeleton } from "skullet/react";
import { TextMorph } from "torph/react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AppShell } from "@/components/layout/app-shell";
import { MachineStatusGrid } from "@/components/dashboard/machine-status-grid";
import {
  INITIAL_MACHINES,
  VIRTUAL_SENSOR_SUMMARY,
  type MachineCardData,
  type PortfolioQuadrant,
} from "@/lib/mock-dashboard-data";

type QuadrantFilter = "ALL" | PortfolioQuadrant;

export function MachinesPageClient() {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "demo"
  );
  const [machines, setMachines] =
    React.useState<MachineCardData[]>(INITIAL_MACHINES);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [quadrant, setQuadrant] = React.useState<QuadrantFilter>("ALL");
  const [liveEnabled, setLiveEnabled] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview?range=today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.dataSource) setDataSource(data.dataSource);
        if (Array.isArray(data?.machines) && data.machines.length > 0) {
          setMachines(data.machines);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!liveEnabled) return;
    const timer = window.setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.status === "OFF") {
            return { ...m, sessionDurationSec: m.sessionDurationSec + 3 };
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
  }, [liveEnabled]);

  const visibleMachines = React.useMemo(() => {
    if (quadrant === "ALL") return machines;
    return machines.filter((m) => m.portfolioQuadrant === quadrant);
  }, [machines, quadrant]);

  const totalPowerW = machines.reduce((sum, m) => sum + m.currentPowerW, 0);
  const virtualPowerW = Math.max(
    0,
    VIRTUAL_SENSOR_SUMMARY.mainMeterPowerW - totalPowerW
  );
  const idleCount = machines.filter((m) => m.status === "IDLE").length;

  return (
    <AppShell
      title="Mesin"
      dataSource={dataSource}
      actions={
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
          <span className="text-[11px] font-medium text-emerald-300">
            <TextMorph>{liveEnabled ? "Live" : "Jeda"}</TextMorph>
          </span>
          <Switch
            checked={liveEnabled}
            onCheckedChange={setLiveEnabled}
            aria-label="Toggle live stream"
            className="scale-75 data-checked:bg-emerald-500"
          />
        </div>
      }
    >
      <div className="space-y-5">
        {/* Compact Live Summary Strip */}
        <Skeleton loading={loading} id="machines-summary" label="Memuat beban">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-border/80 bg-card/90">
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-xs text-zinc-400">Beban Aktif</span>
                <span className="font-mono text-lg font-bold text-white">
                  <TextMorph>{`${totalPowerW.toLocaleString("id-ID")} W`}</TextMorph>
                </span>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/90">
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-xs text-zinc-400">Virtual CT</span>
                <span className="font-mono text-lg font-bold text-sky-300">
                  <TextMorph>{`${virtualPowerW.toLocaleString("id-ID")} W`}</TextMorph>
                </span>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/90">
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-xs text-zinc-400">Sedang Idle</span>
                <span className="font-mono text-lg font-bold text-amber-300">
                  <TextMorph>{`${idleCount} mesin`}</TextMorph>
                </span>
              </CardContent>
            </Card>
          </div>
        </Skeleton>

        {/* Search & Quadrant Filter */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari mesin (Ctrl+K)..."
              className="h-9 bg-card pl-9 text-xs"
            />
          </div>

          <Select
            value={quadrant}
            onValueChange={(val) => {
              if (val) setQuadrant(val as QuadrantFilter);
            }}
          >
            <SelectTrigger className="h-9 border-border/80 bg-card text-xs text-zinc-200">
              <Filter className="mr-1.5 size-3.5 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kuadran</SelectItem>
              <SelectItem value="CRITICAL">Kuadran II (Kritis)</SelectItem>
              <SelectItem value="LEVERAGE_POWER">Kuadran I (Daya)</SelectItem>
              <SelectItem value="LEVERAGE_TIME">Kuadran III (Jam)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Machines Grid */}
        <Skeleton loading={loading} id="machines-grid" label="Memuat mesin">
          <MachineStatusGrid
            machines={visibleMachines}
            searchQuery={searchQuery}
          />
        </Skeleton>
      </div>
    </AppShell>
  );
}
