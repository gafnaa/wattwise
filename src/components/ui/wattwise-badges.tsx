"use client";

import * as React from "react";
import {
  Calculator,
  Cpu,
  Radio,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type DataSourceKind =
  | "sensor"
  | "kalkulasi"
  | "prediksi-ml"
  | "rekomendasi-ai";

const DATA_SOURCE_META: Record<
  DataSourceKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  sensor: {
    label: "Sensor",
    icon: Radio,
    className:
      "bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-inset ring-blue-600/15 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/20",
  },
  kalkulasi: {
    label: "Kalkulasi",
    icon: Calculator,
    className:
      "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-600/10 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-400/15",
  },
  "prediksi-ml": {
    label: "Prediksi ML",
    icon: Cpu,
    className:
      "bg-[#ECFDF5] text-[#047857] ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
  },
  "rekomendasi-ai": {
    label: "Rekomendasi AI",
    icon: Sparkles,
    className:
      "bg-[#F5F3FF] text-[#6D28D9] ring-1 ring-inset ring-violet-600/15 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-400/20",
  },
};

export function DataSourceBadge({
  kind,
  className = "",
}: {
  kind: DataSourceKind;
  className?: string;
}) {
  const meta = DATA_SOURCE_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap ${meta.className} ${className}`}
    >
      <Icon className="size-3 shrink-0" />
      <span>{meta.label}</span>
    </span>
  );
}

export type PillTone =
  | "green"
  | "emerald"
  | "amber"
  | "red"
  | "blue"
  | "violet"
  | "gray";

const PILL_STYLES: Record<PillTone, { wrap: string; dot: string }> = {
  green: {
    wrap: "bg-[#F0FDF4] text-[#15803D] ring-1 ring-inset ring-green-600/15 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-400/20",
    dot: "bg-[#16A34A]",
  },
  emerald: {
    wrap: "bg-[#ECFDF5] text-[#047857] ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
    dot: "bg-[#059669]",
  },
  amber: {
    wrap: "bg-[#FFFBEB] text-[#B45309] ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
    dot: "bg-[#D97706]",
  },
  red: {
    wrap: "bg-[#FEF2F2] text-[#B91C1C] ring-1 ring-inset ring-red-600/15 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-400/20",
    dot: "bg-[#DC2626]",
  },
  blue: {
    wrap: "bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-inset ring-blue-600/15 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/20",
    dot: "bg-[#2563EB]",
  },
  violet: {
    wrap: "bg-[#F5F3FF] text-[#6D28D9] ring-1 ring-inset ring-violet-600/15 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-400/20",
    dot: "bg-[#7C3AED]",
  },
  gray: {
    wrap: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-600/10 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/15",
    dot: "bg-zinc-400",
  },
};

export function StatusPill({
  label,
  tone,
  className = "",
}: {
  label: string;
  tone: PillTone;
  className?: string;
}) {
  const s = PILL_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-4 whitespace-nowrap ${s.wrap} ${className}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${s.dot}`} />
      <span>{label}</span>
    </span>
  );
}

export function machineStatusToPill(status: string): {
  label: string;
  tone: PillTone;
} {
  switch (status) {
    case "WORKING":
      return { label: "Working", tone: "green" };
    case "IDLE":
      return { label: "Idle", tone: "amber" };
    case "START_UP":
      return { label: "Start-up", tone: "blue" };
    default:
      return { label: "Off", tone: "gray" };
  }
}

export function KpiMetricCard({
  icon,
  iconTone = "emerald",
  title,
  source,
  value,
  unit,
  trendLabel,
  trendDirection,
  trendTone = "positive",
  subtitle,
}: {
  icon: React.ReactNode;
  iconTone?: "emerald" | "zinc" | "amber";
  title: string;
  source?: DataSourceKind;
  value: React.ReactNode;
  unit?: string;
  trendLabel?: string;
  trendDirection?: "up" | "down";
  trendTone?: "positive" | "warning";
  subtitle?: string;
}) {
  const iconColor =
    iconTone === "emerald"
      ? "text-[#059669] dark:text-emerald-400"
      : iconTone === "amber"
        ? "text-[#D97706] dark:text-amber-400"
        : "text-zinc-500 dark:text-zinc-400";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 ${iconColor}`}>{icon}</span>
          <span className="truncate text-[13px] font-medium text-muted-foreground">
            {title}
          </span>
        </div>
        {source && <DataSourceBadge kind={source} />}
      </div>

      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.025em] text-foreground tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[13px] font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      {(trendLabel || subtitle) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {trendLabel && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums ${
                trendTone === "positive"
                  ? "bg-[#F0FDF4] text-[#15803D] dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-[#FFFBEB] text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              {trendDirection === "down" ? (
                <TrendingDown className="size-3" />
              ) : (
                <TrendingUp className="size-3" />
              )}
              {trendLabel}
            </span>
          )}
          {subtitle && (
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
