"use client";

import * as React from "react";
import { Check, Send, SlidersHorizontal, Zap } from "lucide-react";
import { TextMorph } from "torph/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
      setTelegramResult({ ok: false, error: "Gagal menghubungi server." });
    } finally {
      setSendingTelegram(false);
    }
  }

  return (
    <>
      <Card className="border-border/80 bg-card/90">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal className="size-4 text-orange-400" />
            Simulator Hemat
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Slider 1 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">Kurangi Waktu Idle</span>
                <span className="font-mono font-semibold text-orange-300">
                  <TextMorph>{`${idleReductionMin} mnt/hari`}</TextMorph>
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
                className="[&_[data-slot=slider-range]]:bg-orange-500 [&_[data-slot=slider-thumb]]:size-4"
              />
            </div>

            {/* Slider 2 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">Kurangi Start-up</span>
                <span className="font-mono font-semibold text-emerald-300">
                  <TextMorph>{`${startupReductionPct}%`}</TextMorph>
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
                className="[&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:size-4"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-zinc-400">Estimasi Hemat / Bulan</p>
              <p className="mt-0.5 font-mono text-2xl font-bold text-emerald-400">
                <TextMorph>{formatRupiah(savings.totalSavingIdr)}</TextMorph>
              </p>
              <p className="font-mono text-[11px] text-zinc-500">
                <TextMorph>{`${savings.totalSavedKwh} kWh / bulan`}</TextMorph>
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setTelegramOpen(true)}
              className="shrink-0 bg-sky-600 text-xs font-semibold text-white hover:bg-sky-500"
            >
              <Send className="mr-1.5 size-3.5" />
              Kirim Telegram
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Preview Dialog */}
      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Zap className="size-4 text-sky-400" />
              WattWise Bot
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-border/80 bg-[#0e1621] p-4">
            <div className="space-y-2 rounded-xl bg-[#182533] p-3.5 text-xs leading-relaxed text-zinc-100">
              <p className="font-semibold text-amber-300">
                ⚡ Laporan Hemat Energi — {WORKSHOP_INFO.name}
              </p>
              <p>
                Potensi kerugian idle:{" "}
                <strong className="font-mono text-rose-300">
                  {formatRupiah(currentIdleLossIdr)}
                </strong>
              </p>
              <p className="text-zinc-200">
                Kurangi idle <strong>{idleReductionMin} mnt/hari</strong> &amp;
                start-up <strong>{startupReductionPct}%</strong> → hemat{" "}
                <strong className="font-mono text-emerald-400">
                  {formatRupiah(savings.totalSavingIdr)}/bln
                </strong>
              </p>
            </div>
          </div>

          {telegramResult && (
            <p
              className={`rounded-lg border px-3 py-2 text-xs ${
                telegramResult.ok
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-300"
              }`}
            >
              {telegramResult.ok
                ? telegramResult.mode === "live"
                  ? "Terkirim ke Telegram."
                  : "Terkirim (Mode Simulasi)."
                : telegramResult.error ?? "Gagal mengirim."}
            </p>
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
                  Terkirim
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-3.5" />
                  Kirim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
