"use client";

import { Cpu, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SettingsMachineItem } from "@/app/api/settings/route";
import type { PortfolioQuadrant } from "@/lib/mock-dashboard-data";

interface MatrixEnergyPortfolioProps {
  machines: SettingsMachineItem[];
  onSelectMachine: (machine: SettingsMachineItem) => void;
}

const QUADRANTS: Array<{
  key: PortfolioQuadrant;
  roman: string;
  title: string;
  subtitle: string;
  sensorAdvice: string;
  accentClass: string;
  badgeClass: string;
}> = [
  {
    key: "LEVERAGE_POWER",
    roman: "I",
    title: "Leverage Power Demand",
    subtitle: "Daya tinggi • Jam operasi rendah",
    sensorAdvice: "Sensor selektif",
    accentClass: "border-amber-500/30 bg-amber-950/15",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  {
    key: "CRITICAL",
    roman: "II",
    title: "Critical Machine",
    subtitle: "Daya tinggi • Jam operasi tinggi",
    sensorAdvice: "Wajib PZEM-004T",
    accentClass: "border-rose-500/35 bg-rose-950/20",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  },
  {
    key: "NONCRITICAL",
    roman: "IV",
    title: "Noncritical",
    subtitle: "Daya rendah • Jam operasi rendah",
    sensorAdvice: "Virtual Sensor (CT)",
    accentClass: "border-sky-500/30 bg-sky-950/15",
    badgeClass: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  },
  {
    key: "LEVERAGE_TIME",
    roman: "III",
    title: "Leverage Operating Time",
    subtitle: "Daya rendah • Jam operasi tinggi",
    sensorAdvice: "Pantau durasi idle",
    accentClass: "border-emerald-500/30 bg-emerald-950/15",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
];

export function MatrixEnergyPortfolio({
  machines,
  onSelectMachine,
}: MatrixEnergyPortfolioProps) {
  return (
    <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white">
          Matrix Energy Portfolio (Thiede et al., 2013)
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Pemetaan prioritas pemasangan sensor fisik PZEM-004T vs Virtual Sensor
          berdasarkan Daya Nominal (kW) &amp; Jam Operasi Tahunan. Klik mesin
          untuk mengedit parameter.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>↑ Daya Nominal Tinggi (&ge; 3,0 kW)</span>
          <span>Jam Operasi Tinggi (&ge; 1.600 jam/thn) →</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {QUADRANTS.map((q) => {
            const list = machines.filter((m) => m.portfolioQuadrant === q.key);
            return (
              <div
                key={q.key}
                className={`flex min-h-[145px] flex-col justify-between rounded-xl border p-3.5 ${q.accentClass}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full border border-white/15 bg-background/80 font-mono text-xs font-bold text-white">
                        {q.roman}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {q.title}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {q.subtitle}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${q.badgeClass}`}
                    >
                      {q.sensorAdvice}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {list.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic">
                        Belum ada mesin pada kuadran ini
                      </span>
                    ) : (
                      list.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectMachine(m)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-background/80 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-orange-500/50 hover:text-white"
                        >
                          {m.hasPhysicalSensor ? (
                            <Radio className="size-3 text-emerald-400" />
                          ) : (
                            <Cpu className="size-3 text-sky-400" />
                          )}
                          <span className="font-medium">{m.name}</span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            {(m.ratedPowerW / 1000).toFixed(1)} kW
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <p className="mt-3 text-right font-mono text-[10px] text-zinc-500">
                  {list.length} mesin
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
