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
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
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
          <SelectTrigger className="h-8 w-[84px] rounded-lg border-border bg-card text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kwh">kWh</SelectItem>
            <SelectItem value="idr">Rp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Header */}
      <div className="mt-5 grid grid-cols-[1.5fr_1.1fr_0.7fr_0.95fr] items-center gap-3 border-b border-border pb-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
        <span>Mesin</span>
        <span>Konsumsi</span>
        <span className="text-right">kWh</span>
        <span className="text-right">Est. Biaya</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/60">
        {rows.map((r) => {
          const pill = machineStatusToPill(r.status);
          const pct = Math.max(
            6,
            Math.round(
              ((unitMode === "kwh" ? r.totalKwh : r.estCostIdr) / maxVal) * 100
            )
          );
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.5fr_1.1fr_0.7fr_0.95fr] items-center gap-3 py-3 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.name}</p>
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
          );
        })}
      </div>

      {/* Footer Total */}
      <div className="mt-auto grid grid-cols-[1.5fr_1.1fr_0.7fr_0.95fr] items-center gap-3 border-t border-border pt-3 text-xs font-semibold">
        <span className="text-muted-foreground">Total {rows.length} mesin</span>
        <span />
        <span className="text-right font-mono text-foreground tabular-nums">
          {sumKwh.toLocaleString("id-ID", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </span>
        <span className="text-right font-mono text-foreground tabular-nums">
          {formatRupiah(sumCost)}
        </span>
      </div>
    </div>
  );
}
