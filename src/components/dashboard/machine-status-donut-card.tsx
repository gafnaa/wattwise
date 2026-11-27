"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  DataSourceBadge,
  machineStatusToPill,
  StatusPill,
} from "@/components/ui/wattwise-badges";
import type { MachineCardData, PeriodMetrics } from "@/lib/mock-dashboard-data";

function subscribeNoop() {
  return () => {};
}

export function MachineStatusDonutCard({
  machines,
  metrics,
}: {
  machines: MachineCardData[];
  metrics: PeriodMetrics;
}) {
  const isClient = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const workingPct =
    metrics.isoDistribution.find((d) => d.key === "working")?.pct ?? 52;
  const idlePct =
    metrics.isoDistribution.find((d) => d.key === "idle")?.pct ?? 24;
  const startupPct =
    metrics.isoDistribution.find((d) => d.key === "startup")?.pct ?? 6;
  const offPct = Math.max(0, 100 - workingPct - idlePct - startupPct);

  const slices = [
    { key: "Working", value: workingPct, color: "#059669" },
    { key: "Idle", value: idlePct, color: "#D97706" },
    { key: "Start-up", value: startupPct, color: "#2563EB" },
    { key: "Off", value: offPct, color: "#94A3B8" },
  ];

  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Status Mesin
        </h2>
        <DataSourceBadge kind="prediksi-ml" />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Distribusi waktu operasi (ISO 14955-5)
      </p>

      {/* Donut + Legend */}
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-[126px] w-[126px] shrink-0">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={40}
                  outerRadius={58}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="size-full rounded-full border-[14px] border-muted" />
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {workingPct}%
            </span>
            <span className="text-[11px] text-muted-foreground">Working</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-2 text-xs">
          {slices.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.key}</span>
              </span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {s.value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Machine List */}
      <div className="mt-4 divide-y divide-border/70 border-t border-border pt-2">
        {machines.slice(0, 6).map((m) => {
          const pill = machineStatusToPill(m.status);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 py-2 text-xs"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                {m.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-muted-foreground tabular-nums">
                  {m.currentPowerW.toLocaleString("id-ID")} W
                </span>
                <StatusPill label={pill.label} tone={pill.tone} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
