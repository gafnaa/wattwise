"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataSourceBadge,
  machineStatusToPill,
  StatusPill,
} from "@/components/ui/wattwise-badges";
import { formatRupiah, type MachineCardData } from "@/lib/mock-dashboard-data";

export function EnergyPerMachineCard({
  machines,
  tariffIdrPerKwh,
  periodLabel,
}: {
  machines: MachineCardData[];
  tariffIdrPerKwh: number;
  periodLabel: string;
}) {
  const [unitMode, setUnitMode] = React.useState<"kwh" | "idr">("kwh");

  const rows = React.useMemo(() => {
    const computed = machines.map((m) => {
      const workKwh = (m.workingHoursMonth * m.baselineWorkingW) / 1000;
      const idleKwh = m.idleLossMonthIdr / Math.max(1, tariffIdrPerKwh);
      const totalKwh = Number(Math.max(idleKwh, workKwh + idleKwh).toFixed(1));
      const estCostIdr = Math.round(totalKwh * tariffIdrPerKwh);
      return {
        ...m,
        totalKwh,
        estCostIdr,
      };
    });
    return computed.sort((a, b) => b.totalKwh - a.totalKwh);
  }, [machines, tariffIdrPerKwh]);

  const maxVal = Math.max(
    1,
    ...rows.map((r) => (unitMode === "kwh" ? r.totalKwh : r.estCostIdr))
  );
  const sumKwh = rows.reduce((s, r) => s + r.totalKwh, 0);
  const sumCost = rows.reduce((s, r) => s + r.estCostIdr, 0);

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Konsumsi Energi per Mesin
            </h2>
            <DataSourceBadge kind="sensor" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peringkat konsumsi {periodLabel.toLowerCase()} beserta estimasi biaya
          </p>
        </div>

        <Select
          value={unitMode}
          onValueChange={(v) => setUnitMode(v === "idr" ? "idr" : "kwh")}
        >
          <SelectTrigger className="h-8 w-[84px] shrink-0 rounded-lg border-border bg-card text-xs font-medium">
            <SelectValue>{unitMode === "idr" ? "Rp" : "kWh"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kwh">kWh</SelectItem>
            <SelectItem value="idr">Rp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop/Tablet 4-Col Header */}
      <div className="mt-5 hidden grid-cols-[1.5fr_1fr_0.7fr_1fr] items-center gap-3 border-b border-border pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
        <span>Mesin</span>
        <span>Konsumsi</span>
        <span className="text-right">kWh</span>
        <span className="text-right">Est. Biaya</span>
      </div>

      {/* Responsive Rows: stacked cards on <sm, aligned 4-col grid on sm+ */}
      <div className="mt-3 divide-y divide-border/70 sm:mt-0">
        {rows.map((r) => {
          const pill = machineStatusToPill(r.status);
          const pct = Math.max(
            6,
            Math.round(
              ((unitMode === "kwh" ? r.totalKwh : r.estCostIdr) / maxVal) * 100
            )
          );
          return (
            <div key={r.id} className="py-3 text-xs">
              {/* Mobile stacked layout */}
              <div className="space-y-2 sm:hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-foreground">
                    {r.name}
                  </span>
                  <StatusPill label={pill.label} tone={pill.tone} />
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#059669]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                  <span className="font-medium text-foreground">
                    {r.totalKwh.toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    kWh
                  </span>
                  <span className="text-muted-foreground">
                    {formatRupiah(r.estCostIdr)}
                  </span>
                </div>
              </div>

              {/* Tablet/Desktop 4-column layout */}
              <div className="hidden grid-cols-[1.5fr_1fr_0.7fr_1fr] items-center gap-3 sm:grid">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {r.name}
                  </p>
                  <div className="mt-1">
                    <StatusPill label={pill.label} tone={pill.tone} />
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#059669]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <span className="text-right font-mono font-medium text-foreground tabular-nums">
                  {r.totalKwh.toLocaleString("id-ID", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>

                <span className="text-right font-mono text-muted-foreground tabular-nums">
                  {formatRupiah(r.estCostIdr)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Total */}
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs font-semibold sm:grid sm:grid-cols-[1.5fr_1fr_0.7fr_1fr] sm:gap-3">
        <span className="text-muted-foreground">Total {rows.length} mesin</span>
        <span className="hidden sm:block" />
        <span className="text-right font-mono text-foreground tabular-nums">
          {sumKwh.toLocaleString("id-ID", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          <span className="font-sans font-normal text-muted-foreground sm:hidden">
            kWh
          </span>
        </span>
        <span className="text-right font-mono text-foreground tabular-nums">
          {formatRupiah(sumCost)}
        </span>
      </div>
    </div>
  );
}
