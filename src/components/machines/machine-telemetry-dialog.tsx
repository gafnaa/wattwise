"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataSourceBadge,
  machineStatusToPill,
  StatusPill,
} from "@/components/ui/wattwise-badges";
import { formatRupiah, type MachineCardData } from "@/lib/mock-dashboard-data";

interface TelemetryReadingItem {
  id: string;
  recordedAt: string;
  powerW: number;
  voltageV: number | null;
  currentA: number | null;
  powerFactor: number | null;
  predictedStatus: string;
  statusConfidence: number | null;
}

interface MachineTelemetryResponse {
  dataSource: "database" | "demo";
  machine: {
    id: string;
    code: string;
    name: string;
    ratedPowerW: number;
    deviceUid: string | null;
  };
  windowHours: number;
  summary: {
    sampleCount: number;
    avgPowerW: number;
    maxPowerW: number;
    integratedKwh: number;
    estimatedCostIdr: number;
    idleMinutes: number;
    workingMinutes: number;
  };
  readings: TelemetryReadingItem[];
}

export function MachineTelemetryDialog({
  machine,
  onClose,
}: {
  machine: MachineCardData | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = React.useState<MachineTelemetryResponse | null>(
    null
  );
  const [loading, setLoading] = React.useState(() => Boolean(machine));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!machine) return;
    let active = true;
    const controller = new AbortController();

    fetch(
      `/api/machines/${encodeURIComponent(machine.id)}/telemetry?hours=24&limit=60`,
      {
        cache: "no-store",
        signal: controller.signal,
      }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MachineTelemetryResponse>;
      })
      .then((data) => {
        if (active) {
          setPayload(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active && (err as { name?: string })?.name !== "AbortError") {
          setError("Gagal memuat telemetri mesin dari server.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [machine]);

  const chartData = React.useMemo(() => {
    if (!payload) return [];
    return payload.readings.map((r) => ({
      time: new Date(r.recordedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      powerW: Math.round(r.powerW),
      status: r.predictedStatus,
      confidencePct:
        r.statusConfidence !== null ? Math.round(r.statusConfidence * 100) : null,
    }));
  }, [payload]);

  return (
    <Dialog
      open={Boolean(machine)}
      onOpenChange={(open) => {
        if (!open) {
          setPayload(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>{machine?.name ?? "Detail Telemetri"}</DialogTitle>
            <DataSourceBadge kind="sensor" />
            <DataSourceBadge kind="prediksi-ml" />
          </div>
          <DialogDescription>
            {machine?.code} · {machine?.deviceUid ?? "Virtual CT"} · Kapasitas{" "}
            {machine?.ratedPowerW.toLocaleString("id-ID")} W · Batas alert idle{" "}
            {machine?.idleAlertThresholdMin} menit
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Memuat riwayat daya 24 jam terakhir...
          </div>
        ) : error || !payload ? (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
            {error ?? "Belum ada data telemetri untuk mesin ini."}
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* 4 Compact Summary Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Rata-rata Daya
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                  {payload.summary.avgPowerW.toLocaleString("id-ID")} W
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-3">
                <p className="text-[11px] text-muted-foreground">Puncak Daya</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                  {payload.summary.maxPowerW.toLocaleString("id-ID")} W
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Energi ({payload.summary.sampleCount} sampel)
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                  {payload.summary.integratedKwh.toLocaleString("id-ID")} kWh
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Estimasi Biaya
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-[#047857] tabular-nums dark:text-emerald-400">
                  {formatRupiah(payload.summary.estimatedCostIdr)}
                </p>
              </div>
            </div>

            {/* Power Profile Chart */}
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs font-medium text-foreground">
                Profil Daya Aktif (Watt) — {payload.summary.sampleCount} Sampel
                Terakhir
              </p>
              <div className="mt-3 h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="wwTelFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ active, payload: pts }) => {
                        if (!active || !pts?.length) return null;
                        const p = pts[0]?.payload as {
                          time: string;
                          powerW: number;
                          status: string;
                          confidencePct: number | null;
                        };
                        return (
                          <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
                            <p className="font-mono font-semibold text-foreground">
                              {p.time}
                            </p>
                            <p className="mt-1 font-mono text-foreground">
                              {p.powerW.toLocaleString("id-ID")} W
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              RF: {p.status}
                              {p.confidencePct !== null
                                ? ` (${p.confidencePct}%)`
                                : ""}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="powerW"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#wwTelFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latest Readings Table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2 text-right">Daya</th>
                    <th className="px-3 py-2 text-right">Tegangan / Arus</th>
                    <th className="px-3 py-2">Status Mesin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {[...payload.readings]
                    .reverse()
                    .slice(0, 8)
                    .map((r) => {
                      const pill = machineStatusToPill(r.predictedStatus);
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {new Date(r.recordedAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-foreground tabular-nums">
                            {Math.round(r.powerW).toLocaleString("id-ID")} W
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground tabular-nums">
                            {r.voltageV !== null ? `${r.voltageV} V` : "—"} /{" "}
                            {r.currentA !== null ? `${r.currentA} A` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <StatusPill label={pill.label} tone={pill.tone} />
                              {r.statusConfidence !== null && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {Math.round(r.statusConfidence * 100)}%
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
