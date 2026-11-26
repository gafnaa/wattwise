"use client";

import * as React from "react";
import { Check, Send, SlidersHorizontal, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  calculateWhatIfSavings,
  formatRupiah,
  WORKSHOP_INFO,
  type MachineCardData,
} from "@/lib/mock-dashboard-data";

interface WhatIfSimulatorProps {
  machines: MachineCardData[];
  currentIdleLossIdr: number;
}

export function WhatIfSimulator({
  machines,
  currentIdleLossIdr,
}: WhatIfSimulatorProps) {
  const [idleReductionMin, setIdleReductionMin] = React.useState(30);
  const [startupReductionPct, setStartupReductionPct] = React.useState(35);
  const [telegramOpen, setTelegramOpen] = React.useState(false);
  const [sendingTelegram, setSendingTelegram] = React.useState(false);
  const [telegramResult, setTelegramResult] = React.useState<{
    ok: boolean;
    mode?: "live" | "simulated";
    error?: string;
  } | null>(null);

  const savings = React.useMemo(
    () =>
      calculateWhatIfSavings({
        idleReductionMinPerDay: idleReductionMin,
        startupReductionPct,
        machines,
        tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
        workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
      }),
    [idleReductionMin, startupReductionPct, machines]
  );

  async function handleSendTelegram() {
    setSendingTelegram(true);
    setTelegramResult(null);
    try {
      const res = await fetch("/api/telegram/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idleReductionMinPerDay: idleReductionMin,
          startupReductionPct,
          projectedMonthlySavingIdr: savings.totalSavingIdr,
          currentIdleLossIdr,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: "live" | "simulated";
        error?: string;
      };
      setTelegramResult({
        ok: Boolean(res.ok && data.ok),
        mode: data.mode,
        error: data.error,
      });
    } catch {
      setTelegramResult({
        ok: false,
        error: "Gagal menghubungi server Telegram.",
      });
    } finally {
      setSendingTelegram(false);
    }
  }

  return (
    <>
      <Card className="flex h-full flex-col justify-between border-border/80 bg-card/90 shadow-lg shadow-black/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="size-4 text-orange-400" />
              Simulator Hemat &ldquo;What-If&rdquo;
            </CardTitle>
            <Badge
              variant="outline"
              className="border-orange-500/35 bg-orange-500/10 text-[10px] text-orange-300"
            >
              Interaktif
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Simulasikan penghematan listrik bulanan berdasarkan perubahan SOP
            operator
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Slider 1: Pengurangan Waktu Idle */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">
                  Kurangi Waktu Idle Mesin
                </span>
                <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-orange-300">
                  {idleReductionMin} menit/hari
                </span>
              </div>
              <Slider
                value={[idleReductionMin]}
                min={0}
                max={60}
                step={5}
                onValueChange={(val) =>
                  setIdleReductionMin(Array.isArray(val) ? (val[0] ?? 0) : val)
                }
                className="[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-orange-500 [&_[data-slot=slider-range]]:to-amber-400 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-orange-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                <span>0 mnt</span>
                <span>30 mnt</span>
                <span>60 mnt</span>
              </div>
            </div>

            {/* Slider 2: Pengurangan Start-up Berlebih */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200">
                  Kurangi Start-up Berlebih
                </span>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                  {startupReductionPct}%
                </span>
              </div>
              <Slider
                value={[startupReductionPct]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) =>
                  setStartupReductionPct(
                    Array.isArray(val) ? (val[0] ?? 0) : val
                  )
                }
                className="[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-emerald-500 [&_[data-slot=slider-range]]:to-teal-400 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-emerald-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Output Box + Kirim Laporan Button */}
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/35 via-background/80 to-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-medium text-zinc-400">
                Estimasi Penghematan Tambahan
              </p>
              <p className="mt-0.5 font-mono text-xl font-bold text-emerald-400">
                {formatRupiah(savings.totalSavingIdr)}{" "}
                <span className="text-xs font-normal text-zinc-400">
                  / bulan
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                ≈ {savings.totalSavedKwh} kWh dihemat per bulan (26 hari kerja)
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setTelegramOpen(true)}
              className="shrink-0 bg-gradient-to-r from-sky-600 to-blue-600 text-xs font-semibold text-white shadow-md shadow-sky-600/20 hover:from-sky-500 hover:to-blue-500"
            >
              <Send className="mr-1.5 size-3.5" />
              Kirim Laporan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Bot Preview Modal (sesuai Lampiran 5 Gambar 5.3) */}
      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Zap className="size-4 text-sky-400" />
              Pratinjau Laporan — WattWise Bot (Telegram)
            </DialogTitle>
            <DialogDescription>
              Format pesan ringkas yang dikirim ke Telegram pemilik &amp;
              teknisi bengkel.
            </DialogDescription>
          </DialogHeader>

          {/* Mock Telegram Chat Bubble */}
          <div className="rounded-xl border border-border/80 bg-[#0e1621] p-4">
            <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                W
              </div>
              <div>
                <p className="text-xs font-semibold text-white">WattWise Bot</p>
                <p className="text-[10px] text-sky-400">bot • aktif</p>
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl rounded-tl-sm bg-[#182533] p-3.5 text-xs leading-relaxed text-zinc-100 shadow-sm">
              <p className="font-semibold text-amber-300">
                ⚡ Laporan Hemat Energi - {WORKSHOP_INFO.name} ⚡
              </p>
              <p>
                Sistem mendeteksi total potensi kerugian idle periode ini:{" "}
                <strong className="font-mono text-rose-300">
                  {formatRupiah(currentIdleLossIdr)}
                </strong>
                .
              </p>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/35 p-2.5">
                <p className="font-semibold text-emerald-300">
                  💡 Saran Tindakan Utama:
                </p>
                <p className="mt-1 text-zinc-200">
                  Jika waktu idle{" "}
                  <strong>Mesin Edge Bander &amp; Panel Saw Sliding</strong>{" "}
                  dikurangi <strong>{idleReductionMin} menit/hari</strong> dan
                  start-up berlebih ditekan{" "}
                  <strong>{startupReductionPct}%</strong>, Anda langsung
                  menghemat:
                </p>
                <p className="mt-1.5 font-mono text-sm font-bold text-emerald-400">
                  💰 {formatRupiah(savings.totalSavingIdr)} / bulan
                </p>
              </div>
              <p className="text-right font-mono text-[10px] text-zinc-500">
                Terkirim otomatis • ISO 14955-5
              </p>
            </div>
          </div>

          {telegramResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                telegramResult.ok
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-300"
              }`}
            >
              {telegramResult.ok
                ? telegramResult.mode === "live"
                  ? "Laporan berhasil dikirim langsung ke Telegram Bot pemilik bengkel."
                  : "Laporan berhasil diproses (Mode Simulasi — isi TELEGRAM_BOT_TOKEN & TELEGRAM_DEFAULT_CHAT_ID di .env untuk pengiriman nyata)."
                : `Pengiriman gagal: ${telegramResult.error ?? "kesalahan tidak diketahui"}`}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTelegramOpen(false)}
            >
              Tutup
            </Button>
            <Button
              type="button"
              disabled={sendingTelegram}
              onClick={handleSendTelegram}
              className="bg-sky-600 text-white hover:bg-sky-500"
            >
              {sendingTelegram ? (
                "Mengirim..."
              ) : telegramResult?.ok ? (
                <>
                  <Check className="mr-1.5 size-4" />
                  {telegramResult.mode === "live"
                    ? "Terkirim ke Telegram"
                    : "Terkirim (Simulasi)"}
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-3.5" />
                  Kirim ke Telegram Pemilik
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
