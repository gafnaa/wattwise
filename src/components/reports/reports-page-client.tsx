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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  pdf: "Dokumen PDF (Siap Cetak)",
  csv: "Spreadsheet Excel (CSV)",
  telegram: "Kirim Ringkasan ke Telegram",
};

function formatReportDateWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
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
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
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
    closeModalOnSuccess?: boolean;
  }) {
    setCreating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range: params.range,
          scope: params.scope,
          format: params.format,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: SerializedAuditReport;
        downloadUrl?: string | null;
      };

      if (!res.ok || !json.report) {
        setErrorMessage(json.error ?? "Gagal membuat laporan pemakaian energi.");
        return;
      }

      setReports((prev) => [json.report!, ...prev]);

      if (params.format === "telegram") {
        setStatusMessage(
          json.report.status === "SENT"
            ? "Ringkasan laporan berhasil dikirim ke Telegram dan dicatat di daftar laporan."
            : "Laporan tercatat, namun pengiriman ke Telegram gagal."
        );
      } else if (json.downloadUrl) {
        const ext = params.format === "pdf" ? "pdf" : "csv";
        const slug = params.scope.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        triggerFileDownload(
          json.downloadUrl,
          `wattwise-laporan-${params.range}-${slug}.${ext}`
        );
        setStatusMessage(
          params.format === "pdf"
            ? "Laporan PDF berhasil dibuat dan mulai diunduh."
            : "Laporan Excel (CSV) berhasil dibuat dan mulai diunduh."
        );
      }

      if (params.closeModalOnSuccess) {
        setCreateDialogOpen(false);
      }
    } catch {
      setErrorMessage("Terjadi kendala koneksi saat membuat laporan.");
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
      closeModalOnSuccess: true,
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
      <div className="space-y-5 sm:space-y-6">
        {/* Header with Unduh Laporan & Buat Laporan side-by-side */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Laporan
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              Pantau ringkasan pemakaian listrik bengkel dan unduh laporan dalam
              format PDF, Excel (CSV), atau kirim ke Telegram.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={creating}
              onClick={() =>
                triggerFileDownload(
                  "/api/export/audit?range=month&format=pdf&scope=ALL",
                  "wattwise-laporan-bulanan.pdf"
                )
              }
              className="h-9 gap-1.5 rounded-lg border-border bg-card px-3.5 text-xs font-medium whitespace-nowrap"
            >
              <FileDown className="size-3.5" />
              <span>Unduh Laporan</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setCreateDialogOpen(true);
              }}
              className="h-9 gap-1.5 rounded-lg bg-[#059669] px-3.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-[#047857]"
            >
              <Plus className="size-3.5" />
              <span>Buat Laporan</span>
            </Button>
          </div>
        </div>

        {/* Inline feedback banner after creating/sending report */}
        {statusMessage && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/90 bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46] dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] font-medium opacity-75 hover:opacity-100"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Full-Width Refined Reports Table Card */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          {loadingReports ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Memuat daftar laporan...
            </div>
          ) : reports.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Belum ada laporan yang dibuat
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Klik tombol Buat Laporan di kanan atas untuk membuat laporan
                pemakaian listrik dalam format PDF, Excel (CSV), atau kirim ke
                Telegram.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4 h-9 gap-1.5 rounded-lg bg-[#059669] px-3.5 text-xs font-semibold text-white hover:bg-[#047857]"
              >
                <Plus className="size-3.5" />
                <span>Buat Laporan Pertama</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile stacked cards (<md) */}
              <div className="divide-y divide-border/70 px-4 md:hidden">
                {reports.map((rep, index) => {
                  const scopeSlug = rep.machineScope
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, "");
                  const pdfUrl = `/api/export/audit?range=${rep.periodRange}&format=pdf&scope=${encodeURIComponent(rep.machineScope)}`;
                  const csvUrl = `/api/export/audit?range=${rep.periodRange}&format=csv&scope=${encodeURIComponent(rep.machineScope)}`;
                  return (
                    <div key={rep.id} className="space-y-3 py-4 text-xs">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {rep.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {rep.source === "AUTOMATIC"
                                ? "Otomatis"
                                : "Manual"}{" "}
                              · {RANGE_LABELS[rep.periodRange]} ·{" "}
                              {rep.totalEnergyKwh.toLocaleString("id-ID")} kWh ·
                              Efisiensi {rep.efficiencyPct}%
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {formatReportDateWib(rep.createdAt)}
                            </p>
                          </div>
                        </div>
                        {renderStatusPill(rep.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <button
                          type="button"
                          onClick={() =>
                            triggerFileDownload(
                              pdfUrl,
                              `wattwise-laporan-${rep.periodRange}-${scopeSlug}.pdf`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-[#ECFDF5] px-2.5 py-1.5 text-[11.5px] font-medium text-[#047857] transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <FileText className="size-3.5" />
                          <span>Unduh PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerFileDownload(
                              csvUrl,
                              `wattwise-laporan-${rep.periodRange}-${scopeSlug}.csv`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                          <span>Unduh CSV</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === rep.id}
                          onClick={() => void handleDeleteReport(rep.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#DC2626] dark:hover:border-red-900/60 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/Tablet refined table (md+) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/35 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <th className="w-12 py-3 pr-2 pl-5 text-center">No</th>
                      <th className="px-3 py-3">Nama Laporan</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Ringkasan Energi</th>
                      <th className="px-3 py-3">Waktu Dibuat</th>
                      <th className="py-3 pr-5 pl-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {reports.map((rep, index) => {
                      const scopeSlug = rep.machineScope
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, "");
                      const pdfUrl = `/api/export/audit?range=${rep.periodRange}&format=pdf&scope=${encodeURIComponent(rep.machineScope)}`;
                      const csvUrl = `/api/export/audit?range=${rep.periodRange}&format=csv&scope=${encodeURIComponent(rep.machineScope)}`;
                      return (
                        <tr
                          key={rep.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="py-3.5 pr-2 pl-5 text-center font-mono text-xs font-medium text-muted-foreground tabular-nums">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="font-medium text-foreground">
                              {rep.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {rep.source === "AUTOMATIC"
                                ? "Laporan otomatis"
                                : "Dibuat manual"}{" "}
                              · {RANGE_LABELS[rep.periodRange]}
                            </p>
                          </td>
                          <td className="px-3 py-3.5">
                            {renderStatusPill(rep.status)}
                          </td>
                          <td className="px-3 py-3.5 font-mono text-[11.5px] text-foreground tabular-nums">
                            <p>
                              {rep.totalEnergyKwh.toLocaleString("id-ID")} kWh ·
                              Efisiensi {rep.efficiencyPct}%
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Biaya idle {formatRupiah(rep.idleLossIdr)}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 font-mono text-muted-foreground">
                            {formatReportDateWib(rep.createdAt)}
                          </td>
                          <td className="py-3.5 pr-5 pl-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  triggerFileDownload(
                                    pdfUrl,
                                    `wattwise-laporan-${rep.periodRange}-${scopeSlug}.pdf`
                                  )
                                }
                                title="Unduh dokumen PDF siap cetak"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-[#ECFDF5] px-2.5 py-1.5 text-[11.5px] font-medium text-[#047857] transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
                              >
                                <FileText className="size-3.5" />
                                <span>Unduh PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  triggerFileDownload(
                                    csvUrl,
                                    `wattwise-laporan-${rep.periodRange}-${scopeSlug}.csv`
                                  )
                                }
                                title="Unduh data tabel Excel (CSV)"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-muted"
                              >
                                <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                                <span>Unduh CSV</span>
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === rep.id}
                                onClick={() => void handleDeleteReport(rep.id)}
                                title="Hapus dari daftar laporan"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#DC2626] dark:hover:border-red-900/60 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Hapus</span>
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
      </div>

      {/* Modal Card: Buat Laporan Manual (muncul saat tombol "Buat Laporan" diklik) */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Buat Laporan Manual</DialogTitle>
            <DialogDescription>
              Pilih periode, mesin, dan format laporan yang ingin Anda unduh
              atau kirim ke Telegram.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateManualReport}
            className="mt-2 space-y-4"
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

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="h-9 rounded-lg text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="h-9 rounded-lg bg-[#059669] px-4 text-xs font-semibold text-white hover:bg-[#047857]"
              >
                {creating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : selectedFormat === "telegram" ? (
                  <Send className="mr-1.5 size-3.5" />
                ) : (
                  <FileDown className="mr-1.5 size-3.5" />
                )}
                <span>
                  {selectedFormat === "pdf"
                    ? "Buat & Unduh PDF"
                    : selectedFormat === "csv"
                      ? "Buat & Unduh CSV"
                      : "Kirim ke Telegram"}
                </span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
