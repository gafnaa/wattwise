"use client";

import { Cpu, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  advice: string;
  accentClass: string;
  badgeClass: string;
}> = [
  {
    key: "LEVERAGE_POWER",
    roman: "I",
    title: "Leverage Power",
    advice: "Sensor selektif",
    accentClass: "border-amber-500/25 bg-amber-950/10",
    badgeClass: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  {
    key: "CRITICAL",
    roman: "II",
    title: "Critical Machine",
    advice: "Wajib PZEM-004T",
    accentClass: "border-rose-500/30 bg-rose-950/15",
    badgeClass: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  },
  {
    key: "NONCRITICAL",
    roman: "IV",
    title: "Noncritical",
    advice: "Virtual CT",
    accentClass: "border-sky-500/25 bg-sky-950/10",
    badgeClass: "border-sky-500/35 bg-sky-500/10 text-sky-300",
  },
  {
    key: "LEVERAGE_TIME",
    roman: "III",
    title: "Leverage Time",
    advice: "Pantau idle",
    accentClass: "border-emerald-500/25 bg-emerald-950/10",
    badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
];

export function MatrixEnergyPortfolio({
  machines,
  onSelectMachine,
}: MatrixEnergyPortfolioProps) {
  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white">
          Matrix Energy Portfolio
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>↑ Daya &ge; 3 kW</span>
          <span>Jam Operasi &ge; 1.600 jam/thn →</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {QUADRANTS.map((q) => {
            const list = machines.filter((m) => m.portfolioQuadrant === q.key);
            return (
              <div
                key={q.key}
                className={`flex min-h-[126px] flex-col justify-between rounded-xl border p-3.5 ${q.accentClass}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full border border-white/15 bg-background/80 font-mono text-[11px] font-bold text-white">
                        {q.roman}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {q.title}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${q.badgeClass}`}
                    >
                      {q.advice}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {list.length === 0 ? (
                      <span className="text-[11px] text-zinc-600">—</span>
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
                          <span>{m.name}</span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            {(m.ratedPowerW / 1000).toFixed(1)} kW
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
