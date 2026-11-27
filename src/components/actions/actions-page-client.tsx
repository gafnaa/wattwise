"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  History,
  Info,
  Loader2,
  Send,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DataSourceBadge,
  KpiMetricCard,
  StatusPill,
} from "@/components/ui/wattwise-badges";
import type { DashboardOverviewResponse } from "@/lib/dashboard/service";
import {
  calculateWhatIfSavings,
  formatRupiah,
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
  type ActionLogItem,
} from "@/lib/mock-dashboard-data";

export function ActionsPageClient() {
  const [overview, setOverview] = React.useState<DashboardOverviewResponse>({
    dataSource: "demo",
    workshop: {
      id: "demo-ws-skh-01",
      code: WORKSHOP_INFO.code,
      name: WORKSHOP_INFO.name,
      location: WORKSHOP_INFO.location,
      tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
      workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
      esp32OnlineCount: WORKSHOP_INFO.esp32OnlineCount,
      esp32TotalCount: WORKSHOP_INFO.esp32TotalCount,
    },
    metrics: PERIOD_METRICS.month,
    machines: INITIAL_MACHINES,
    virtualSensor: VIRTUAL_SENSOR_SUMMARY,
    actionLogs: INITIAL_ACTION_LOGS,
  });
  const [showHistory, setShowHistory] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [aiBannerMsg, setAiBannerMsg] = React.useState<string | null>(null);
  const [idleReductionMin, setIdleReductionMin] = React.useState(30);
  const [startupReductionPct, setStartupReductionPct] = React.useState(35);
  const [sendingTg, setSendingTg] = React.useState(false);
  const [tgResult, setTgResult] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/overview?range=month", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardOverviewResponse;
      if (data?.metrics) setOverview(data);
    } catch {
      // fallback
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview?range=month", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardOverviewResponse | null) => {
        if (active && data?.metrics) setOverview(data);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerateAi() {
    setGenerating(true);
    setAiBannerMsg(null);
    try {
      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacePending: true }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        aiSource?: string;
        aiModel?: string | null;
        newlyCreatedCount?: number;
        workshopPeakIdleWindow?: string | null;
      };
      if (res.ok && json.ok) {
        setAiBannerMsg(
          json.aiSource === "AI_LLM"
            ? `Diperbarui oleh Gemini (${json.aiModel ?? "AI_LLM"}) · Jam rawan idle: ${json.workshopPeakIdleWindow ?? "Terdeteksi"}`
            : "Rekomendasi diperbarui menggunakan Rule-Based Playbook."
        );
        await loadData();
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleStatus(item: ActionLogItem) {
    const nextStatus = item.status === "PENDING" ? "COMPLETED" : "PENDING";
    setUpdatingId(item.id);
    try {
      const res = await fetch(`/api/recommendations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setOverview((prev) => ({
          ...prev,
          actionLogs: prev.actionLogs.map((a) =>
            a.id === item.id ? { ...a, status: nextStatus } : a
          ),
        }));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const whatIf = React.useMemo(
    () =>
      calculateWhatIfSavings({
        idleReductionMinPerDay: idleReductionMin,
        startupReductionPct,
        machines: overview.machines,
        tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
        workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
      }),
    [
      idleReductionMin,
      overview.machines,
      overview.workshop.tariffIdrPerKwh,
      overview.workshop.workingDaysPerMonth,
      startupReductionPct,
    ]
  );

  async function handleSendTelegramReport() {
    setSendingTg(true);
    setTgResult(null);
    try {
      const res = await fetch("/api/telegram/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idleReductionMinPerDay: idleReductionMin,
          startupReductionPct,
          projectedMonthlySavingIdr: whatIf.totalSavingIdr,
          currentIdleLossIdr: overview.metrics.idleLossIdr,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; mode?: string };
      setTgResult(
        json.ok
          ? `Laporan terkirim ke Telegram (${json.mode === "live" ? "Live" : "Simulasi"}).`
          : "Gagal mengirim laporan ke Telegram."
      );
    } finally {
      setSendingTg(false);
    }
  }

  const pendingLogs = overview.actionLogs.filter((a) => a.status === "PENDING");
  const completedLogs = overview.actionLogs.filter(
    (a) => a.status === "COMPLETED"
  );
  const displayedLogs = showHistory ? completedLogs : pendingLogs;
  const totalMonthlyPotentialIdr = pendingLogs.reduce(
    (s, a) => s + a.estimatedSavingIdr,
    0
  );
  const savingPctOfBill =
    overview.metrics.totalEnergyCostIdr > 0
      ? Math.round(
          (Math.max(totalMonthlyPotentialIdr, whatIf.totalSavingIdr) /
            overview.metrics.totalEnergyCostIdr) *
            100
        )
      : 0;
  const highPriorityCount = pendingLogs.filter(
    (a) => a.estimatedSavingIdr >= 350_000
  ).length;

  function handleExportCsv() {
    const a = document.createElement("a");
    a.href = "/api/export/audit?range=month";
    a.download = "wattwise-rekomendasi-ai.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AppShell
      title="Rekomendasi AI"
      section="Menu Utama"
      dataSource={overview.dataSource}
      workshopName={overview.workshop.name}
      onlineDevices={overview.workshop.esp32OnlineCount}
      totalDevices={overview.workshop.esp32TotalCount}
      pendingRecommendationsCount={pendingLogs.length}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              Rekomendasi AI
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingLogs.length} rekomendasi aktif · Dihasilkan dari pola
              konsumsi 30 hari terakhir (Random Forest + Gemini AI)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
              className="h-8 gap-1.5 rounded-lg border-border bg-card text-xs font-medium"
            >
              <History className="size-3.5" />
              <span>
                {showHistory
                  ? `Aktif (${pendingLogs.length})`
                  : `Riwayat (${completedLogs.length})`}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={generating}
              onClick={handleGenerateAi}
              className="h-8 gap-1.5 rounded-lg bg-[#059669] text-xs font-medium text-white hover:bg-[#047857]"
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Generate AI</span>
            </Button>
          </div>
        </div>

        {/* 3 KPI Cards — Exact Figma 04 · Rekomendasi AI */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiMetricCard
            icon={<Zap className="size-4" />}
            iconTone="emerald"
            title="Potensi Hemat per Bulan"
            source="rekomendasi-ai"
            value={formatRupiah(
              Math.max(totalMonthlyPotentialIdr, whatIf.totalSavingIdr)
            )}
            trendLabel={`-${savingPctOfBill}%`}
            trendDirection="down"
            trendTone="positive"
            subtitle="dari biaya listrik bulanan"
          />

          <KpiMetricCard
            icon={<Wallet className="size-4" />}
            iconTone="zinc"
            title="Rekomendasi Aktif"
            source="kalkulasi"
            value={pendingLogs.length}
            unit="rekomendasi"
            subtitle={`${highPriorityCount} prioritas tinggi · ${Math.max(0, pendingLogs.length - highPriorityCount)} sedang`}
          />

          <KpiMetricCard
            icon={<CheckCircle2 className="size-4" />}
            iconTone="amber"
            title="Sudah Diterapkan"
            source="prediksi-ml"
            value={completedLogs.length}
            unit="rekomendasi"
            trendLabel={`ISO ${overview.metrics.operationalEfficiencyPct}%`}
            trendDirection="down"
            trendTone="positive"
            subtitle="status selesai di lapangan"
          />
        </section>

        {/* Main Active Recommendations Card */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {showHistory ? "Riwayat Sudah Diterapkan" : "Rekomendasi Aktif"}
                </h3>
                <DataSourceBadge kind="rekomendasi-ai" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Diurutkan berdasarkan potensi penghematan per bulan
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="size-3.5" />
              <span>Ekspor daftar</span>
            </button>
          </div>

          {/* Violet AI Disclaimer */}
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-violet-200/80 bg-[#F5F3FF] px-3.5 py-2.5 text-xs leading-relaxed text-[#6D28D9] dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              {aiBannerMsg ??
                "Insight dihasilkan AI dari prediksi status mesin (Random Forest) dan perhitungan biaya. Bukan perintah otomatis — verifikasi kondisi lapangan sebelum bertindak."}
            </p>
          </div>

          {/* Recommendation Rows */}
          <div className="mt-4 divide-y divide-border/70">
            {displayedLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                {showHistory
                  ? "Belum ada rekomendasi yang ditandai selesai."
                  : "Semua rekomendasi aktif sudah diterapkan! Klik Generate AI untuk pemindaian terbaru."}
              </div>
            ) : (
              displayedLogs.map((item, idx) => {
                const isHigh = idx === 0 || item.estimatedSavingIdr >= 350_000;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-foreground">
                          {item.machineName}
                        </span>
                        {item.status === "COMPLETED" ? (
                          <StatusPill label="Selesai" tone="green" />
                        ) : (
                          <StatusPill
                            label={
                              isHigh ? "Prioritas Tinggi" : "Prioritas Sedang"
                            }
                            tone={isHigh ? "red" : "amber"}
                          />
                        )}
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        <span>
                          Terdeteksi {item.dateLabel} · Kode {item.machineCode}
                        </span>
                      </p>
                      <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-foreground">
                          Saran:
                        </span>{" "}
                        {item.recommendation}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="text-xs text-muted-foreground">
                        Potensi hemat/bln{" "}
                        <span className="font-mono text-[13px] font-semibold text-foreground">
                          {formatRupiah(item.estimatedSavingIdr)}
                        </span>
                      </p>
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleToggleStatus(item)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#047857] hover:underline disabled:opacity-50 dark:text-emerald-400"
                      >
                        {updatingId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        <span>
                          {item.status === "PENDING"
                            ? "Terapkan"
                            : "Buka kembali"}
                        </span>
                        <ArrowUpRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Compact What-If Simulator + Kirim Telegram */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Simulasi Penghematan (What-If) & Laporan Telegram
                </h3>
                <DataSourceBadge kind="kalkulasi" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Atur target pengurangan durasi idle harian lalu kirim langsung ke
                @wattwise_smart_bot
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">
                Estimasi hemat bulanan
              </p>
              <p className="font-mono text-lg font-semibold text-[#047857] dark:text-emerald-400">
                {formatRupiah(whatIf.totalSavingIdr)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  Kurangi waktu idle per mesin / hari
                </span>
                <span className="font-mono font-semibold text-[#047857] dark:text-emerald-400">
                  {idleReductionMin} menit
                </span>
              </div>
              <Slider
                value={[idleReductionMin]}
                min={5}
                max={90}
                step={5}
                onValueChange={(v) =>
                  setIdleReductionMin(Array.isArray(v) ? (v[0] ?? 30) : v)
                }
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  Tekan siklus start-up berlebih
                </span>
                <span className="font-mono font-semibold text-[#047857] dark:text-emerald-400">
                  {startupReductionPct}%
                </span>
              </div>
              <Slider
                value={[startupReductionPct]}
                min={0}
                max={70}
                step={5}
                onValueChange={(v) =>
                  setStartupReductionPct(Array.isArray(v) ? (v[0] ?? 35) : v)
                }
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {tgResult ??
                `Hemat energi ~${whatIf.totalSavedKwh.toLocaleString("id-ID")} kWh/bulan (${overview.workshop.workingDaysPerMonth} hari kerja).`}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={sendingTg}
              onClick={handleSendTelegramReport}
              className="h-9 gap-1.5 rounded-lg bg-[#059669] px-4 text-xs font-medium text-white hover:bg-[#047857]"
            >
              {sendingTg ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>Kirim Laporan ke Telegram</span>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
