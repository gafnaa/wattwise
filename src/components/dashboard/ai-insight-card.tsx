"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Clock, Info } from "lucide-react";
import { DataSourceBadge, StatusPill } from "@/components/ui/wattwise-badges";
import { formatRupiah, type ActionLogItem } from "@/lib/mock-dashboard-data";

export function AiInsightCard({
  actionLogs,
}: {
  actionLogs: ActionLogItem[];
}) {
  const pendingFirst = React.useMemo(() => {
    const pending = actionLogs.filter((a) => a.status === "PENDING");
    return (pending.length > 0 ? pending : actionLogs).slice(0, 3);
  }, [actionLogs]);

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Insight Energi
            </h2>
            <DataSourceBadge kind="rekomendasi-ai" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Temuan idle berdasarkan klasifikasi status mesin &amp; AI Advisor
          </p>
        </div>
        <Link
          href="/actions"
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Lihat semua</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {/* Violet AI Disclaimer — Hue-tinted ink for WCAG AA contrast */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-violet-200/80 bg-[#F5F3FF] px-3 py-2.5 text-xs leading-relaxed text-[#5B21B6] dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Insight dihasilkan AI dari prediksi status mesin (Random Forest) dan
          perhitungan biaya. Bukan perintah otomatis — verifikasi kondisi
          lapangan sebelum bertindak.
        </p>
      </div>

      <div className="mt-4 divide-y divide-border/70">
        {pendingFirst.map((item, idx) => {
          const isHigh = idx === 0 || item.estimatedSavingIdr >= 400_000;
          return (
            <div
              key={item.id}
              className="space-y-1.5 py-3.5 first:pt-1 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-foreground">
                    {item.machineName}
                  </span>
                  <StatusPill
                    label={isHigh ? "Prioritas Tinggi" : "Prioritas Sedang"}
                    tone={isHigh ? "red" : "amber"}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Est. hemat{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {formatRupiah(item.estimatedSavingIdr)}
                  </span>
                </span>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                <span>
                  {item.dateLabel} · {item.machineCode}
                </span>
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium text-foreground">Saran:</span>{" "}
                  {item.recommendation}
                </p>
                <Link
                  href="/actions"
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                >
                  <span>Detail</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
