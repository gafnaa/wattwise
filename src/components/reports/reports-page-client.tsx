"use client";

import * as React from "react";
import { Calendar, CheckCircle2, FileDown, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/ui/wattwise-badges";
import type { DashboardOverviewResponse } from "@/lib/dashboard/service";
import {
  calculateWhatIfSavings,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  WORKSHOP_INFO,
  type DateRangeKey,
} from "@/lib/mock-dashboard-data";

interface ReportRecord {
  id: string;
  title: string;
  subtitle: string;
  status: "READY" | "SCHEDULED";
  period: string;
  createdAt: string;
  range: DateRangeKey;
  formatLabel: string;
}

function buildDefaultReports(machineCount: number): ReportRecord[] {
  return [
    {
      id: "rep-1",
      title: "Laporan Mingguan Konsumsi Energi",
      subtitle: `Otomatis · CSV · ${machineCount} mesin`,
      status: "READY",
      period: "7 hari terakhir",
      createdAt: "Hari ini, 06.00",
      range: "week",
      formatLabel: "Unduh CSV",
    },
    {
      id: "rep-2",
      title: "Laporan Audit Bulanan ISO 14955-5",
      subtitle: `Otomatis · CSV · ${machineCount} mesin`,
      status: "READY",
      period: "30 hari terakhir",
      createdAt: "1 Nov, 06.00",
      range: "month",
      formatLabel: "Unduh CSV",
    },
    {
      id: "rep-3",
      title: "Ringkasan Operasional Hari Ini",
      subtitle: `Manual · CSV · ${machineCount} mesin`,
      status: "READY",
      period: "Hari ini",
      createdAt: "Baru diperbarui",
      range: "today",
      formatLabel: "Unduh CSV",
    },
    {
      id: "rep-4",
      title: "Laporan Bulanan Periode Berikutnya",
      subtitle: `Otomatis · CSV + Telegram · ${machineCount} mesin`,
      status: "SCHEDULED",
      period: "Bulan depan",
      createdAt: "Terjadwal Senin 06.00",
      range: "month",
      formatLabel: "Unduh Pratinjau",
    },
  ];
}

export function ReportsPageClient() {
  const [reports, setReports] = React.useState<ReportRecord[]>(() =>
    buildDefaultReports(INITIAL_MACHINES.length)
  );
  const [machines, setMachines] = React.useState(INITIAL_MACHINES);
  const [workshopName, setWorkshopName] = React.useState<string>(
    WORKSHOP_INFO.name
  );
  const [tariffIdr, setTariffIdr] = React.useState<number>(
    WORKSHOP_INFO.tariffIdrPerKwh
  );
  const [workingDays, setWorkingDays] = React.useState<number>(
    WORKSHOP_INFO.workingDaysPerMonth
  );
  const [idleLossIdr, setIdleLossIdr] = React.useState<number>(
    PERIOD_METRICS.month.idleLossIdr
  );
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "database"
  );
  const [selectedRange, setSelectedRange] =
    React.useState<DateRangeKey>("month");
  const [selectedScope, setSelectedScope] = React.useState("ALL");
  const [selectedFormat, setSelectedFormat] = React.useState("csv");
  const [creating, setCreating] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview?range=month", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DashboardOverviewResponse | null) => {
        if (!active || !d) return;
        setMachines(d.machines);
        setWorkshopName(d.workshop.name);
        setTariffIdr(d.workshop.tariffIdrPerKwh);
        setWorkingDays(d.workshop.workingDaysPerMonth);
        setIdleLossIdr(d.metrics.idleLossIdr);
        setDataSource(d.dataSource);
        setReports(buildDefaultReports(d.machines.length));
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  function downloadAuditCsv(range: DateRangeKey, filename: string) {
    const a = document.createElement("a");
    a.href = `/api/export/audit?range=${range}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleCreateManualReport(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setStatusMessage(null);
    try {
      const scopeLabel =
        selectedScope === "ALL"
          ? `Semua mesin (${machines.length})`
          : machines.find((m) => m.code === selectedScope)?.name ??
            selectedScope;
      const periodLabel =
        selectedRange === "today"
          ? "Hari ini"
          : selectedRange === "week"
            ? "7 hari terakhir"
            : "30 hari terakhir";

      const newReport: ReportRecord = {
        id: `rep-${Date.now()}`,
        title: `Laporan Manual — ${scopeLabel}`,
        subtitle: `Manual · ${selectedFormat.toUpperCase()} · ${scopeLabel}`,
        status: "READY",
        period: periodLabel,
        createdAt: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        range: selectedRange,
        formatLabel: "Unduh CSV",
      };
      setReports((prev) => [newReport, ...prev]);

      if (selectedFormat === "telegram") {
        const whatIf30 = calculateWhatIfSavings({
          idleReductionMinPerDay: 30,
          startupReductionPct: 35,
          machines,
          tariffIdrPerKwh: tariffIdr,
          workingDaysPerMonth: workingDays,
        });
        const res = await fetch("/api/telegram/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idleReductionMinPerDay: 30,
            startupReductionPct: 35,
            projectedMonthlySavingIdr: whatIf30.totalSavingIdr,
            currentIdleLossIdr: idleLossIdr,
          }),
        });
        const j = (await res.json()) as { ok?: boolean };
        setStatusMessage(
          j.ok
            ? "Laporan berhasil dikirim langsung ke @wattwise_smart_bot."
            : "Gagal mengirim laporan ke Telegram."
        );
      } else {
        downloadAuditCsv(
          selectedRange,
          `wattwise-laporan-${selectedRange}-${selectedScope.toLowerCase()}.csv`
        );
        setStatusMessage("Laporan CSV audit energi berhasil dibuat & diunduh.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell
      title="Laporan"
      section="Menu Utama"
      dataSource={dataSource}
      workshopName={workshopName}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Laporan
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              Laporan konsumsi energi otomatis dan manual · Format CSV Audit
              &amp; Telegram
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadAuditCsv("month", "wattwise-laporan-bulanan.csv")
            }
            className="h-9 gap-1.5 self-start rounded-lg border-border bg-card px-3.5 text-xs font-medium whitespace-nowrap sm:self-auto"
          >
            <FileDown className="size-3.5" />
            <span>Unduh Laporan Terbaru</span>
          </Button>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Left: Daftar Laporan */}
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-8">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                Daftar Laporan
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {reports.length} laporan · laporan otomatis dibuat setiap Senin
                06.00 WIB
              </p>
            </div>

            {/* Mobile stacked cards (<md) */}
            <div className="mt-4 divide-y divide-border/70 md:hidden">
              {reports.map((rep) => (
                <div key={rep.id} className="space-y-2 py-3.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {rep.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {rep.subtitle}
                      </p>
                    </div>
                    <StatusPill
                      label={rep.status === "READY" ? "Siap" : "Terjadwal"}
                      tone={rep.status === "READY" ? "green" : "blue"}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">
                      {rep.period} ·{" "}
                      <span className="font-mono">{rep.createdAt}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadAuditCsv(rep.range, `wattwise-${rep.id}.csv`)
                      }
                      className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                    >
                      {rep.formatLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop/Tablet table (md+) */}
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <th className="pr-4 pb-2.5">Nama laporan</th>
                    <th className="pr-4 pb-2.5">Status</th>
                    <th className="pr-4 pb-2.5">Periode</th>
                    <th className="pr-4 pb-2.5">Dibuat</th>
                    <th className="pb-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {reports.map((rep) => (
                    <tr key={rep.id}>
                      <td className="py-3.5 pr-4">
                        <p className="font-medium text-foreground">
                          {rep.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {rep.subtitle}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusPill
                          label={rep.status === "READY" ? "Siap" : "Terjadwal"}
                          tone={rep.status === "READY" ? "green" : "blue"}
                        />
                      </td>
                      <td className="py-3.5 pr-4 text-foreground">
                        {rep.period}
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-muted-foreground">
                        {rep.createdAt}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            downloadAuditCsv(
                              rep.range,
                              `wattwise-${rep.id}.csv`
                            )
                          }
                          className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                        >
                          {rep.formatLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: Buat Laporan Manual */}
          <section className="h-fit min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Buat Laporan Manual
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ekspor data audit langsung dari Supabase
            </p>

            <form
              onSubmit={handleCreateManualReport}
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Periode
                </Label>
                <Select
                  value={selectedRange}
                  onValueChange={(v) => {
                    if (v === "today" || v === "week" || v === "month") {
                      setSelectedRange(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-xs">
                    <Calendar className="mr-1.5 size-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">30 Hari Terakhir</SelectItem>
                    <SelectItem value="week">7 Hari Terakhir</SelectItem>
                    <SelectItem value="today">Hari Ini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Cakupan mesin
                </Label>
                <Select
                  value={selectedScope}
                  onValueChange={(v) => setSelectedScope(v ?? "ALL")}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua mesin ({machines.length})
                    </SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.name} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Format
                </Label>
                <Select
                  value={selectedFormat}
                  onValueChange={(v) => setSelectedFormat(v ?? "csv")}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      CSV Audit (Excel siap buka)
                    </SelectItem>
                    <SelectItem value="telegram">
                      Kirim Ringkasan ke Telegram Bot
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {statusMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-xs text-[#065F46] dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={creating}
                className="h-10 w-full rounded-lg bg-[#059669] text-xs font-semibold text-white hover:bg-[#047857]"
              >
                {creating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" />
                )}
                <span>Buat laporan</span>
              </Button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
