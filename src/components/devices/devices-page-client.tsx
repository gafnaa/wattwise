"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Database,
  Loader2,
  Plus,
  Radio,
  Trash2,
  Wifi,
} from "lucide-react";
import type { SettingsPayload } from "@/app/api/settings/route";
import { AppShell } from "@/components/layout/app-shell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { KpiMetricCard, StatusPill } from "@/components/ui/wattwise-badges";

interface DeviceStatusRow {
  id: string;
  deviceUid: string;
  isMainMeter: boolean;
  firmwareVersion: string;
  lastSeenAt: string | null;
  status: "ONLINE" | "OFFLINE";
  secondsSinceLastSeen: number | null;
  machine: {
    id: string;
    code: string;
    name: string;
    portfolioQuadrant: string;
  } | null;
}

interface DeviceStatusResponse {
  dataSource: "database" | "demo";
  heartbeatTimeoutSec: number;
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  devices: DeviceStatusRow[];
}

function formatLastSeen(sec: number | null): string {
  if (sec === null) return "Belum pernah sinkron";
  if (sec < 60) return `${sec} detik lalu`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} jam lalu`;
}

export function DevicesPageClient() {
  const [payload, setPayload] = React.useState<DeviceStatusResponse>({
    dataSource: "database",
    heartbeatTimeoutSec: 30,
    totalCount: 0,
    onlineCount: 0,
    offlineCount: 0,
    devices: [],
  });
  const [machines, setMachines] = React.useState<
    Array<{ id: string; code: string; name: string }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  // Add device modal
  const [addOpen, setAddOpen] = React.useState(false);
  const [deviceUid, setDeviceUid] = React.useState("");
  const [selectedMachineId, setSelectedMachineId] = React.useState("NONE");
  const [isMainMeter, setIsMainMeter] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [provisionedKey, setProvisionedKey] = React.useState<string | null>(
    null
  );
  const [copied, setCopied] = React.useState(false);

  const loadDevices = React.useCallback(async () => {
    try {
      const [devRes, setRes] = await Promise.all([
        fetch("/api/iot/devices/status", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      if (devRes.ok) {
        setPayload((await devRes.json()) as DeviceStatusResponse);
      }
      if (setRes.ok) {
        const s = (await setRes.json()) as SettingsPayload;
        setMachines(
          s.machines
            .filter((m) => m.hasPhysicalSensor)
            .map((m) => ({ id: m.id, code: m.code, name: m.name }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function handleRegisterDevice(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setProvisionedKey(null);
    try {
      const res = await fetch("/api/iot/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUid: deviceUid.trim(),
          isMainMeter,
          machineId:
            isMainMeter || selectedMachineId === "NONE"
              ? null
              : selectedMachineId,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        apiKey?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Gagal mendaftarkan perangkat IoT.");
        return;
      }
      setProvisionedKey(json.apiKey ?? null);
      setDeviceUid("");
      await loadDevices();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDevice(uid: string) {
    const res = await fetch(
      `/api/iot/devices?deviceUid=${encodeURIComponent(uid)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadDevices();
    }
  }

  async function handleCopyKey() {
    if (!provisionedKey) return;
    await navigator.clipboard.writeText(provisionedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell
      title="Perangkat IoT"
      section="Manajemen"
      dataSource={payload.dataSource}
      onlineDevices={payload.onlineCount}
      totalDevices={payload.totalCount}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Perangkat IoT
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              {payload.totalCount} node ESP32 terdaftar · {payload.onlineCount}/
              {payload.totalCount} online · Heartbeat timeout{" "}
              {payload.heartbeatTimeoutSec} detik
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setErrorMsg(null);
              setProvisionedKey(null);
              setAddOpen(true);
            }}
            className="h-9 gap-1.5 self-start rounded-lg border-border bg-card px-3.5 text-xs font-medium whitespace-nowrap sm:self-auto"
          >
            <Plus className="size-3.5" />
            <span>Tambah perangkat</span>
          </Button>
        </div>

        {/* 3 KPI Cards */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiMetricCard
            icon={<Radio className="size-4" />}
            iconTone="emerald"
            title="Perangkat Online"
            source="sensor"
            value={payload.onlineCount}
            unit={`/ ${payload.totalCount} sensor`}
            trendLabel={
              payload.offlineCount === 0
                ? "Semua aktif"
                : `${payload.offlineCount} offline`
            }
            trendDirection={payload.offlineCount === 0 ? "down" : "up"}
            trendTone={payload.offlineCount === 0 ? "positive" : "warning"}
            subtitle="ESP32 + PZEM-004T / SCT-013"
          />

          <KpiMetricCard
            icon={<Wifi className="size-4" />}
            iconTone="zinc"
            title="Ambang Heartbeat"
            source="kalkulasi"
            value={payload.heartbeatTimeoutSec}
            unit="detik"
            subtitle="otomatis deteksi node terputus"
          />

          <KpiMetricCard
            icon={<Database className="size-4" />}
            iconTone="amber"
            title="Protokol Ingesti"
            source="prediksi-ml"
            value="HTTPS"
            unit="POST JSON"
            trendLabel="RF aktif"
            trendDirection="down"
            trendTone="positive"
            subtitle="/api/iot/telemetry (single & batch)"
          />
        </section>

        {/* Daftar Perangkat — Mobile Cards + Desktop Table */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Daftar Perangkat
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Autentikasi aman via header{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                X-Device-UID
              </code>{" "}
              &amp;{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                X-API-Key
              </code>{" "}
              (SHA-256)
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Memuat perangkat IoT...
            </div>
          ) : (
            <>
              {/* Mobile Cards (<md) */}
              <div className="mt-4 divide-y divide-border/70 md:hidden">
                {payload.devices.map((dev) => (
                  <div key={dev.id} className="space-y-2 py-3.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-foreground">
                          {dev.deviceUid}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {dev.isMainMeter
                            ? "Meter Induk Workshop"
                            : dev.machine?.name ?? "Belum dipasangkan"}
                        </p>
                      </div>
                      <StatusPill
                        label={dev.status === "ONLINE" ? "Online" : "Offline"}
                        tone={dev.status === "ONLINE" ? "green" : "amber"}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-muted-foreground">
                        fw {dev.firmwareVersion} ·{" "}
                        {formatLastSeen(dev.secondsSinceLastSeen)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDevice(dev.deviceUid)}
                        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-[#DC2626]"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (md+) */}
              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <th className="pr-4 pb-2.5">Perangkat</th>
                      <th className="pr-4 pb-2.5">Status</th>
                      <th className="pr-4 pb-2.5">Mesin terhubung</th>
                      <th className="pr-4 pb-2.5">Sinkron terakhir</th>
                      <th className="pb-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {payload.devices.map((dev) => (
                      <tr key={dev.id}>
                        <td className="py-3.5 pr-4">
                          <p className="font-mono font-semibold text-foreground">
                            {dev.deviceUid}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {dev.isMainMeter
                              ? "Meter Induk PLN (Virtual CT Ref)"
                              : "Sensor Arus / PZEM-004T"}{" "}
                            · firmware {dev.firmwareVersion}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4">
                          <StatusPill
                            label={
                              dev.status === "ONLINE" ? "Online" : "Offline"
                            }
                            tone={dev.status === "ONLINE" ? "green" : "amber"}
                          />
                        </td>
                        <td className="py-3.5 pr-4 font-medium text-foreground">
                          {dev.isMainMeter
                            ? "Meter Induk Workshop"
                            : dev.machine?.name ?? "Belum dipasangkan"}
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-muted-foreground">
                          {formatLastSeen(dev.secondsSinceLastSeen)}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(dev.deviceUid)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-[#DC2626]"
                            title="Hapus perangkat"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Modal Tambah Perangkat IoT */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Daftarkan Perangkat ESP32</DialogTitle>
            <DialogDescription>
              Sistem akan membuat API key baru (ditampilkan sekali saja) untuk
              di-flash ke firmware ESP32.
            </DialogDescription>
          </DialogHeader>

          {provisionedKey ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-emerald-200 bg-[#ECFDF5] p-3.5 text-xs text-[#047857] dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                <p className="font-semibold">
                  Perangkat berhasil didaftarkan! Salin X-API-Key berikut:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-card px-2.5 py-1.5 font-mono text-[11px] text-foreground">
                    {provisionedKey}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyKey}
                    className="h-8 shrink-0"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-[#059669]" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddOpen(false)}
                  className="bg-[#059669] text-white hover:bg-[#047857]"
                >
                  Selesai
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleRegisterDevice} className="space-y-3.5 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Device UID</Label>
                <Input
                  value={deviceUid}
                  onChange={(e) => setDeviceUid(e.target.value)}
                  placeholder="ESP32-PLANER-01"
                  required
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Meter Induk PLN (Main Meter)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Aktifkan jika node ini mengukur daya total panel utama
                  </p>
                </div>
                <Switch
                  checked={isMainMeter}
                  onCheckedChange={(checked) =>
                    setIsMainMeter(Boolean(checked))
                  }
                />
              </div>

              {!isMainMeter && (
                <div className="space-y-1">
                  <Label className="text-xs">Pasangkan ke Mesin</Label>
                  <Select
                    value={selectedMachineId}
                    onValueChange={(v) => setSelectedMachineId(v ?? "NONE")}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue>
                        {selectedMachineId === "NONE"
                          ? "Belum dipasangkan"
                          : (() => {
                              const found = machines.find(
                                (m) => m.id === selectedMachineId
                              );
                              return found
                                ? `${found.name} (${found.code})`
                                : "Pilih mesin";
                            })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Belum dipasangkan</SelectItem>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {errorMsg && <p className="text-xs text-[#DC2626]">{errorMsg}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-[#059669] text-white hover:bg-[#047857]"
                >
                  {submitting && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Daftarkan Perangkat
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
