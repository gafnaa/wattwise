"use client";

import * as React from "react";
import { Boxes, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataSourceBadge } from "@/components/ui/wattwise-badges";

interface ProductionLogRow {
  id: string;
  productCategory: string;
  outputUnits: number;
  periodDate: string;
  notes: string | null;
}

interface ProductionLogsPayload {
  dataSource: "database" | "demo";
  periodDays: number;
  summary: {
    totalEnergyKwh: number;
    totalOutputUnits: number;
    secKwhPerUnit: number;
    categories: Array<{ category: string; units: number }>;
  };
  logs: ProductionLogRow[];
}

export function ProductionSecCard() {
  const [data, setData] = React.useState<ProductionLogsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [category, setCategory] = React.useState("Meja Makan Kayu Jati");
  const [units, setUnits] = React.useState("15");
  const [periodDate, setPeriodDate] = React.useState("2026-11-27");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadProduction = React.useCallback(async () => {
    try {
      const res = await fetch("/api/production-logs?days=30", {
        cache: "no-store",
      });
      if (!res.ok) return;
      setData((await res.json()) as ProductionLogsPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    fetch("/api/production-logs?days=30", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ProductionLogsPayload>) : null))
      .then((payload) => {
        if (active && payload) setData(payload);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateLog(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/production-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCategory: category.trim(),
          outputUnits: Number(units) || 1,
          periodDate,
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Gagal mencatat batch produksi.");
        return;
      }
      setModalOpen(false);
      setNotes("");
      await loadProduction();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Efisiensi Spesifik Produksi (SEC)
            </h2>
            <DataSourceBadge kind="kalkulasi" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Konsumsi listrik per unit produk furnitur (kWh/unit) untuk evaluasi
            baseline vs pasca-intervensi
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            setPeriodDate(new Date().toISOString().slice(0, 10));
            setModalOpen(true);
          }}
          className="h-9 gap-1.5 self-start rounded-lg border-border bg-card px-3.5 text-xs font-medium whitespace-nowrap sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>Catat Produksi</span>
        </Button>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Memuat data produksi...
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* 3-Cell Summary Strip */}
          <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-muted/25 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">
                Specific Energy Consumption (SEC)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-[#047857] tabular-nums dark:text-emerald-400">
                {data.summary.secKwhPerUnit.toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  kWh / unit
                </span>
              </p>
            </div>

            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">
                Total Output (30 Hari)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {data.summary.totalOutputUnits.toLocaleString("id-ID")}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  unit
                </span>
              </p>
            </div>

            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground">
                Energi Terukur (30 Hari)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {data.summary.totalEnergyKwh.toLocaleString("id-ID", {
                  maximumFractionDigits: 1,
                })}{" "}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  kWh
                </span>
              </p>
            </div>
          </div>

          {/* Mobile Stacked List (<md) */}
          <div className="divide-y divide-border/70 md:hidden">
            {data.logs.map((row) => (
              <div key={row.id} className="space-y-1 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {row.productCategory}
                  </span>
                  <span className="font-mono font-semibold text-[#047857] dark:text-emerald-400">
                    {row.outputUnits} unit
                  </span>
                </div>
                <p className="text-muted-foreground">
                  <span className="font-mono">{row.periodDate}</span>
                  {row.notes ? ` · ${row.notes}` : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <th className="pr-4 pb-2.5">Tanggal</th>
                  <th className="pr-4 pb-2.5">Kategori Produk</th>
                  <th className="pr-4 pb-2.5 text-right">Output</th>
                  <th className="pb-2.5">Catatan Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.logs.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4 font-mono text-muted-foreground">
                      {row.periodDate}
                    </td>
                    <td className="py-3 pr-4 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Boxes className="size-3.5 text-muted-foreground" />
                        {row.productCategory}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-semibold text-foreground tabular-nums">
                      {row.outputUnits.toLocaleString("id-ID")} unit
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {row.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Catat Batch Produksi */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Batch Produksi</DialogTitle>
            <DialogDescription>
              Data output furnitur digunakan untuk menghitung rasio kWh/unit
              (SEC) secara otomatis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLog} className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Kategori Produk</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Contoh: Meja Makan Kayu Jati"
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Jumlah Output (unit)</Label>
                <Input
                  type="number"
                  min={1}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  required
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Batch</Label>
                <Input
                  type="date"
                  value={periodDate}
                  onChange={(e) => setPeriodDate(e.target.value)}
                  required
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pasca optimasi jadwal CNC"
                className="h-9 text-xs"
              />
            </div>
            {errorMsg && <p className="text-xs text-[#DC2626]">{errorMsg}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-[#059669] text-white hover:bg-[#047857]"
              >
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Simpan Batch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
