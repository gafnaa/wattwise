"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import type {
  SettingsMachineItem,
  SettingsPayload,
} from "@/app/api/settings/route";
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
import { StatusPill } from "@/components/ui/wattwise-badges";
import type { PortfolioQuadrant } from "@/lib/mock-dashboard-data";

const QUADRANT_LABELS: Record<PortfolioQuadrant, string> = {
  CRITICAL: "Kritis (Sensor Wajib)",
  LEVERAGE_POWER: "Daya Tinggi",
  LEVERAGE_TIME: "Durasi Panjang",
  NONCRITICAL: "Non-Kritis (Virtual CT)",
};

export function MachinesManagementClient() {
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "database"
  );
  const [workshopName, setWorkshopName] = React.useState(
    "Area Produksi Furnitur"
  );
  const [machines, setMachines] = React.useState<SettingsMachineItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Add machine modal
  const [addOpen, setAddOpen] = React.useState(false);
  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("CNC");
  const [newRatedW, setNewRatedW] = React.useState("3500");
  const [newHoursYr, setNewHoursYr] = React.useState("1800");
  const [newThreshold, setNewThreshold] = React.useState("15");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Edit machine modal
  const [editing, setEditing] = React.useState<SettingsMachineItem | null>(null);

  const loadSettings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as SettingsPayload;
      setDataSource(payload.dataSource);
      setWorkshopName(payload.workshop.name);
      setMachines(payload.machines);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleAddMachine(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          machineType: newType,
          ratedPowerW: Number(newRatedW) || 2000,
          annualOperatingHours: Number(newHoursYr) || 1500,
          idleAlertThresholdMin: Number(newThreshold) || 15,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(json.error ?? "Gagal menambahkan mesin.");
        return;
      }
      setAddOpen(false);
      setNewCode("");
      setNewName("");
      await loadSettings();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/machines/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          ratedPowerW: editing.ratedPowerW,
          annualOperatingHours: editing.annualOperatingHours,
          portfolioQuadrant: editing.portfolioQuadrant,
          idleAlertThresholdMin: editing.idleAlertThresholdMin,
          isActive: editing.isActive,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(j.error ?? "Gagal memperbarui mesin.");
        return;
      }
      setEditing(null);
      await loadSettings();
    } finally {
      setSubmitting(false);
    }
  }

  const totalRatedW = machines.reduce((s, m) => s + m.ratedPowerW, 0);

  return (
    <AppShell
      title="Manajemen Mesin"
      section="Manajemen"
      dataSource={dataSource}
      workshopName={workshopName}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              Manajemen Mesin
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Kelola daftar mesin, daya terpasang, ambang idle, dan sensor yang
              terhubung
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
            className="h-9 gap-1.5 self-start rounded-lg border-border bg-card px-3.5 text-xs font-medium whitespace-nowrap sm:self-auto"
          >
            <Plus className="size-3.5" />
            <span>Tambah mesin</span>
          </Button>
        </div>

        {/* Daftar Mesin Table Card — Exact Figma 06 · Manajemen Mesin */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              Daftar Mesin
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {machines.length} mesin terdaftar · total daya terpasang{" "}
              <span className="font-mono font-medium text-foreground">
                {totalRatedW.toLocaleString("id-ID")} W
              </span>
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Memuat daftar mesin...
              </div>
            ) : (
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium text-muted-foreground">
                    <th className="pb-2.5 pr-4 font-medium">Mesin</th>
                    <th className="pb-2.5 pr-4 font-medium">Status</th>
                    <th className="pb-2.5 pr-4 font-medium">Daya terpasang</th>
                    <th className="pb-2.5 pr-4 font-medium">Sensor</th>
                    <th className="pb-2.5 pr-4 font-medium">Kuadran ISO</th>
                    <th className="pb-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {machines.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-foreground">
                          {m.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {m.code} · {m.machineType} · Batas idle{" "}
                          {m.idleAlertThresholdMin} mnt
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusPill
                          label={m.isActive ? "Aktif" : "Perawatan"}
                          tone={m.isActive ? "green" : "amber"}
                        />
                      </td>
                      <td className="py-3.5 pr-4 font-mono font-medium text-foreground tabular-nums">
                        {m.ratedPowerW.toLocaleString("id-ID")} W
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-muted-foreground">
                        {m.deviceUid ??
                          (m.hasPhysicalSensor ? "Belum dipasangkan" : "Virtual CT")}
                      </td>
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {QUADRANT_LABELS[m.portfolioQuadrant]}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setEditing({ ...m });
                          }}
                          className="font-semibold text-[#047857] hover:underline dark:text-emerald-400"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Modal Tambah Mesin */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Mesin Baru</DialogTitle>
            <DialogDescription>
              Kuadran Matrix Energy Portfolio akan diklasifikasi otomatis
              berdasarkan daya dan jam operasi tahunan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMachine} className="space-y-3.5 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kode Mesin</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="PLANER-01"
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipe Mesin</Label>
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType(v ?? "CNC")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNC">CNC Router</SelectItem>
                    <SelectItem value="PANEL_SAW">Panel Saw</SelectItem>
                    <SelectItem value="EDGE_BANDER">Edge Bander</SelectItem>
                    <SelectItem value="DUST_COLLECTOR">
                      Dust Collector
                    </SelectItem>
                    <SelectItem value="BORING">Boring</SelectItem>
                    <SelectItem value="COMPRESSOR">Compressor</SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nama Mesin</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mesin Serut 01"
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Daya (W)</Label>
                <Input
                  type="number"
                  value={newRatedW}
                  onChange={(e) => setNewRatedW(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jam/Tahun</Label>
                <Input
                  type="number"
                  value={newHoursYr}
                  onChange={(e) => setNewHoursYr(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Batas Idle (mnt)</Label>
                <Input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-[#DC2626]">{formError}</p>
            )}
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
                Simpan Mesin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Mesin */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Mesin — {editing?.code}</DialogTitle>
            <DialogDescription>
              Perubahan akan langsung tersimpan ke database Supabase.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Nama Mesin</Label>
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Daya Terpasang (W)</Label>
                  <Input
                    type="number"
                    value={editing.ratedPowerW}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        ratedPowerW: Number(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Batas Alert Idle (menit)</Label>
                  <Input
                    type="number"
                    value={editing.idleAlertThresholdMin}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        idleAlertThresholdMin: Number(e.target.value) || 15,
                      })
                    }
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kuadran Energy Portfolio</Label>
                <Select
                  value={editing.portfolioQuadrant}
                  onValueChange={(v) =>
                    setEditing({
                      ...editing,
                      portfolioQuadrant: (v as PortfolioQuadrant) ?? "CRITICAL",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRITICAL">
                      Kritis (Sensor Wajib)
                    </SelectItem>
                    <SelectItem value="LEVERAGE_POWER">Daya Tinggi</SelectItem>
                    <SelectItem value="LEVERAGE_TIME">
                      Durasi Panjang
                    </SelectItem>
                    <SelectItem value="NONCRITICAL">
                      Non-Kritis (Virtual CT)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Status Operasional Aktif
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Nonaktifkan saat mesin sedang perawatan
                  </p>
                </div>
                <Switch
                  checked={editing.isActive}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, isActive: Boolean(checked) })
                  }
                />
              </div>
              {formError && (
                <p className="text-xs text-[#DC2626]">{formError}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(null)}
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
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
