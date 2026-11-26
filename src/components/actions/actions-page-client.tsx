"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Skeleton } from "skullet/react";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/app-shell";
import { ActionLogTable } from "@/components/dashboard/action-log-table";
import { WhatIfSimulator } from "@/components/dashboard/what-if-simulator";
import {
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  type ActionLogItem,
  type MachineCardData,
} from "@/lib/mock-dashboard-data";

export function ActionsPageClient() {
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "demo"
  );
  const [machines, setMachines] =
    React.useState<MachineCardData[]>(INITIAL_MACHINES);
  const [actionLogs, setActionLogs] =
    React.useState<ActionLogItem[]>(INITIAL_ACTION_LOGS);
  const [idleLossIdr, setIdleLossIdr] = React.useState(
    PERIOD_METRICS.month.idleLossIdr
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview?range=month")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.dataSource) setDataSource(data.dataSource);
        if (typeof data.metrics?.idleLossIdr === "number") {
          setIdleLossIdr(data.metrics.idleLossIdr);
        }
        if (Array.isArray(data.machines) && data.machines.length > 0) {
          setMachines(data.machines);
        }
        if (Array.isArray(data.actionLogs) && data.actionLogs.length > 0) {
          setActionLogs(data.actionLogs);
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

  async function handleToggleStatus(id: string) {
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
      // Pertahankan state optimistik di UI
    }
  }

  return (
    <AppShell title="Hemat & Aksi" dataSource={dataSource}>
      <div className="space-y-5">
        <Skeleton loading={loading} id="actions-sim" label="Memuat simulator">
          <WhatIfSimulator
            machines={machines}
            currentIdleLossIdr={idleLossIdr}
          />
        </Skeleton>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari tindakan atau mesin..."
            className="h-9 bg-card pl-9 text-xs"
          />
        </div>

        <Skeleton loading={loading} id="actions-table" label="Memuat tindakan">
          <ActionLogTable
            logs={actionLogs}
            searchQuery={searchQuery}
            onToggleStatus={handleToggleStatus}
          />
        </Skeleton>
      </div>
    </AppShell>
  );
}
