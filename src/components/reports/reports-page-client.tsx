"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { SerializedAuditReport } from "@/app/api/reports/route";
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
  formatRupiah,
  INITIAL_MACHINES,
  WORKSHOP_INFO,
  type DateRangeKey,
} from "@/lib/mock-dashboard-data";

type ExportFormatChoice = "pdf" | "csv" | "telegram";

const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: "Hari Ini",
  week: "7 Hari Terakhir",
  month: "30 Hari Terakhir",
};

const FORMAT_LABELS: Record<ExportFormatChoice, string> = {
  pdf: "PDF Audit Energi (Siap Cetak)",
  csv: "CSV Audit (Excel Siap Buka)",
  telegram: "Kirim Ringkasan ke Telegram Bot",
};

function formatReportDateWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB"
  );
}

function triggerFileDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ReportsPageClient() {
  const [reports, setReports] = React.useState<SerializedAuditReport[]>([]);
  const [loadingReports, setLoadingReports] = React.useState(true);
  const [machines, setMachines] = React.useState(INITIAL_MACHINES);
  const [workshopName, setWorkshopName] = React.useState<string>(
    WORKSHOP_INFO.name
  );
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "database"
  );
  const [selectedRange, setSelectedRange] =
    React.useState<DateRangeKey>("month");
  const [selectedScope, setSelectedScope] = React.useState("ALL");
  const [selectedFormat, setSelectedFormat] =
    React.useState<ExportFormatChoice>("pdf");
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/dashboard/overview?range=month", { cache: "no-store" }).then(
        (r) => (r.ok ? (r.json() as Promise<DashboardOverviewResponse>) : null)
      ),
      fetch("/api/reports?limit=25", { cache: "no-store" }).then((r) =>
        r.ok
          ? (r.json() as Promise<{
              dataSource?: "database" | "demo";
              reports?: SerializedAuditReport[];
            }>)
          : null
      ),
    ])
      .then(([overviewData, reportsData]) => {
        if (!active) return;
        if (overviewData) {
          setMachines(overviewData.machines);
          setWorkshopName(overviewData.workshop.name);
          setDataSource(overviewData.dataSource);
        }
        if (Array.isArray(reportsData?.reports)) {
          setReports(reportsData.reports);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoadingReports(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function createAndPersistReport(params: {
    range: DateRangeKey;
    scope: string;
    format: ExportFormatChoice;
  }) {
    setCreating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        persisted?: boolean;
        telegramMode?: "live" | "simulated";
        report?: SerializedAuditReport;
        downloadUrl?: string | null;
      };

      if (!res.ok || !json.report) {
        setErrorMessage(json.error ?? "Gagal membuat laporan audit energi.");
        return;
      }

      setReports((prev) => [json.report!, ...prev]);

      if (params.format === "telegram") {
        setStatusMessage(
          json.report.status === "SENT"
            ? `Ringkasan audit terkirim ke @wattwise_smart_bot (${json.telegramMode ?? "live"}) dan tersimpan di riwayat.`
            : "Riwayat tersimpan, namun pengiriman ke Telegram gagal."
        );
      } else if (json.downloadUrl) {
        const ext = params.format === "pdf" ? "pdf" : "csv";
        const slug = params.scope.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        triggerFileDownload(
          json.downloadUrl,
          `wattwise-audit-${params.range}-${slug}.${ext}`
        );
        setStatusMessage(
          params.format === "pdf"
            ? "Laporan PDF Audit Energi (ISO 14955-5) berhasil dibuat, disimpan ke Supabase, & diunduh."
            : "Laporan CSV Audit Energi berhasil dibuat, disimpan ke Supabase, & diunduh."
        );
      }
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan saat membuat laporan.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateManualReport(e: React.FormEvent) {
    e.preventDefault();
    await createAndPersistReport({
      range: selectedRange,
      scope: selectedScope,
      format: selectedFormat,
    });
  }

  async function handleDeleteReport(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  function getScopeLabel(scopeCode: string): string {
    if (scopeCode === "ALL") return `Semua mesin (${machines.length})`;
    const found = machines.find((m) => m.code === scopeCode);
    return found ? `${found.name} (${found.code})` : scopeCode;
  }

  function renderStatusPill(status: SerializedAuditReport["status"]) {
    if (status === "SENT") return <StatusPill label="Terkirim" tone="blue" />;
    if (status === "FAILED") return <StatusPill label="Gagal" tone="amber" />;
    return <StatusPill label="Siap" tone="green" />;
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
              Riwayat laporan audit energi tersimpan di Supabase · Ekspor PDF
              ISO 14955-5, CSV, &amp; Telegram
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                triggerFileDownload(
                  "/api/export/audit?range=month&format=csv&scope=ALL",
                  "wattwise-audit-bulanan.csv"
                )
              }
              className="h-9 gap-1.5 rounded-lg border-border bg-card px-3 text-xs font-medium whitespace-nowrap"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Unduh CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creating}
              onClick={() =>
                void createAndPersistReport({
                  range: "month",
                  scope: "ALL",
                  format: "pdf",
                })
              }
              className="h-9 gap-1.5 rounded-lg bg-[#059669] px-3.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-[#047857]"
            >
              <FileDown className="size-3.5" />
              <span>Ekspor PDF Terbaru</span>
            </Button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Left: Daftar Riwayat Laporan Aktual dari Supabase */}
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Riwayat Laporan Audit
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {loadingReports
                    ? "Memuat riwayat laporan dari Supabase..."
                    : `${reports.length} laporan tersimpan · termasuk ringkasan otomatis cron harian`}
                </p>
              </div>
            </div>

            {loadingReports ? (
              <div className="flex items-center justify-center py-14 text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Memuat daftar laporan...
              </div>
            ) : reports.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                <FileText className="mx-auto size-7 text-muted-foreground/70" />
                <p className="mt-2.5 text-sm font-medium text-foreground">
                  Belum ada riwayat laporan tersimpan
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Buat laporan audit energi pertama dalam format PDF siap cetak
                  atau CSV menggunakan formulir di samping.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={creating}
                  onClick={() =>
                    void createAndPersistReport({
                      range: "month",
                      scope: "ALL",
                      format: "pdf",
                    })
                  }
                  className="mt-4 h-9 gap-1.5 rounded-lg bg-[#059669] px-3.5 text-xs font-semibold text-white hover:bg-[#047857]"
                >
                  <FileDown className="size-3.5" />
                  <span>Buat Laporan Audit Bulanan (PDF)</span>
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile stacked cards (<md) */}
                <div className="mt-4 divide-y divide-border/70 md:hidden">
                  {reports.map((rep) => {
                    const scopeSlug = rep.machineScope
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]/g, "");
                    const pdfUrl = `/api/export/audit?range=${rep.periodRange}&format=pdf&scope=${encodeURIComponent(rep.machineScope)}`;
                    const csvUrl = `/api/export/audit?range=${rep.periodRange}&format=csv&scope=${encodeURIComponent(rep.machineScope)}`;
                    return (
                      <div key={rep.id} className="space-y-2.5 py-3.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {rep.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {rep.source === "AUTOMATIC"
                                ? "Otomatis"
                                : "Manual"}{" "}
                              · {rep.format} ·{" "}
                              {rep.totalEnergyKwh.toLocaleString("id-ID")} kWh ·
                              ISO {rep.efficiencyPct}%
                            </p>
                          </div>
                          {renderStatusPill(rep.status)}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {RANGE_LABELS[rep.periodRange]} ·{" "}
                            {formatReportDateWib(rep.createdAt)}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                triggerFileDownload(
                                  pdfUrl,
                                  `wattwise-audit-${rep.periodRange}-${scopeSlug}.pdf`
                                )
                              }
                              className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                triggerFileDownload(
                                  csvUrl,
                                  `wattwise-audit-${rep.periodRange}-${scopeSlug}.csv`
                                )
                              }
                              className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                            >
                              CSV
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === rep.id}
                              onClick={() => void handleDeleteReport(rep.id)}
                              className="text-muted-foreground hover:text-[#DC2626]"
                              aria-label="Hapus riwayat laporan"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop/Tablet table (md+) */}
                <div className="mt-5 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        <th className="pr-4 pb-2.5">Nama laporan</th>
                        <th className="pr-4 pb-2.5">Status</th>
                        <th className="pr-4 pb-2.5">Snapshot KPI</th>
                        <th className="pr-4 pb-2.5">Dibuat</th>
                        <th className="pb-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {reports.map((rep) => {
                        const scopeSlug = rep.machineScope
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, "");
                        const pdfUrl = `/api/export/audit?range=${rep.periodRange}&format=pdf&scope=${encodeURIComponent(rep.machineScope)}`;
                        const csvUrl = `/api/export/audit?range=${rep.periodRange}&format=csv&scope=${encodeURIComponent(rep.machineScope)}`;
                        return (
                          <tr key={rep.id}>
                            <td className="py-3.5 pr-4">
                              <p className="font-medium text-foreground">
                                {rep.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {rep.source === "AUTOMATIC"
                                  ? "Otomatis"
                                  : "Manual"}{" "}
                                · {rep.format} · {RANGE_LABELS[rep.periodRange]}
                              </p>
                            </td>
                            <td className="py-3.5 pr-4">
                              {renderStatusPill(rep.status)}
                            </td>
                            <td className="py-3.5 pr-4 font-mono text-[11.5px] text-foreground tabular-nums">
                              <p>
                                {rep.totalEnergyKwh.toLocaleString("id-ID")} kWh
                                · ISO {rep.efficiencyPct}%
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Idle {formatRupiah(rep.idleLossIdr)}
                              </p>
                            </td>
                            <td className="py-3.5 pr-4 font-mono text-muted-foreground">
                              {formatReportDateWib(rep.createdAt)}
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerFileDownload(
                                      pdfUrl,
                                      `wattwise-audit-${rep.periodRange}-${scopeSlug}.pdf`
                                    )
                                  }
                                  className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                                >
                                  PDF
                                </button>
                                <span className="text-border">|</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerFileDownload(
                                      csvUrl,
                                      `wattwise-audit-${rep.periodRange}-${scopeSlug}.csv`
                                    )
                                  }
                                  className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  CSV
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === rep.id}
                                  onClick={() =>
                                    void handleDeleteReport(rep.id)
                                  }
                                  className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-[#DC2626]"
                                  aria-label="Hapus riwayat laporan"
                                  title="Hapus riwayat"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Right: Buat Laporan Manual */}
          <section className="h-fit min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Buat Laporan Manual
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Data audit diambil langsung dari Supabase &amp; disimpan ke
              riwayat
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
                    <SelectValue>{RANGE_LABELS[selectedRange]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">{RANGE_LABELS.month}</SelectItem>
                    <SelectItem value="week">{RANGE_LABELS.week}</SelectItem>
                    <SelectItem value="today">{RANGE_LABELS.today}</SelectItem>
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
                    <SelectValue>{getScopeLabel(selectedScope)}</SelectValue>
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
                  onValueChange={(v) => {
                    if (v === "pdf" || v === "csv" || v === "telegram") {
                      setSelectedFormat(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-border bg-card text-xs">
                    <SelectValue>{FORMAT_LABELS[selectedFormat]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">{FORMAT_LABELS.pdf}</SelectItem>
                    <SelectItem value="csv">{FORMAT_LABELS.csv}</SelectItem>
                    <SelectItem value="telegram">
                      {FORMAT_LABELS.telegram}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {statusMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-xs text-[#065F46] dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={creating}
                className="h-10 w-full rounded-lg bg-[#059669] text-xs font-semibold text-white hover:bg-[#047857]"
              >
                {creating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : selectedFormat === "telegram" ? (
                  <Send className="mr-1.5 size-3.5" />
                ) : (
                  <Plus className="mr-1.5 size-3.5" />
                )}
                <span>
                  {selectedFormat === "pdf"
                    ? "Buat & Unduh PDF"
                    : selectedFormat === "csv"
                      ? "Buat & Unduh CSV"
                      : "Kirim ke Telegram Bot"}
                </span>
              </Button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
