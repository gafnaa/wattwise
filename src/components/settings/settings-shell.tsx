"use client";

import * as React from "react";
import {
  BellRing,
  Check,
  Cpu,
  Pencil,
  Plus,
  Radio,
  Save,
  Send,
  Sliders,
  Zap,
} from "lucide-react";
import { Skeleton } from "skullet/react";
import { TextMorph } from "torph/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/layout/app-shell";
import { MatrixEnergyPortfolio } from "@/components/settings/matrix-energy-portfolio";
import type {
  SettingsMachineItem,
  SettingsPayload,
} from "@/app/api/settings/route";
import { classifyEnergyPortfolioQuadrant } from "@/lib/audit/portfolio";
import {
  formatRupiah,
  WORKSHOP_INFO,
  type PortfolioQuadrant,
} from "@/lib/mock-dashboard-data";

const PLN_PRESETS = [
  { label: "B-2/TR", value: 1444.7 },
  { label: "I-3/TM", value: 1114.74 },
  { label: "B-3/TM", value: 1699.53 },
];

const QUADRANT_BADGE: Record<PortfolioQuadrant, { label: string; cls: string }> = {
  CRITICAL: {
    label: "Kritis (II)",
    cls: "border-rose-500/35 bg-rose-500/15 text-rose-300",
  },
  LEVERAGE_POWER: {
    label: "Daya (I)",
    cls: "border-amber-500/35 bg-amber-500/15 text-amber-300",
  },
  LEVERAGE_TIME: {
    label: "Jam (III)",
    cls: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  },
  NONCRITICAL: {
    label: "Virtual CT (IV)",
    cls: "border-sky-500/35 bg-sky-500/15 text-sky-300",
  },
};

export function SettingsShell() {
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "demo"
  );
  const [workshopName, setWorkshopName] = React.useState(WORKSHOP_INFO.name);
  const [workshopLocation, setWorkshopLocation] = React.useState(
    WORKSHOP_INFO.location
  );
  const [tariffIdr, setTariffIdr] = React.useState(
    String(WORKSHOP_INFO.tariffIdrPerKwh)
  );
  const [workingDays, setWorkingDays] = React.useState(
    String(WORKSHOP_INFO.workingDaysPerMonth)
  );
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [machines, setMachines] = React.useState<SettingsMachineItem[]>([]);

  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileFeedback, setProfileFeedback] = React.useState<string | null>(
    null
  );

  const [editingMachine, setEditingMachine] =
    React.useState<SettingsMachineItem | null>(null);
  const [savingMachine, setSavingMachine] = React.useState(false);

  const [addOpen, setAddOpen] = React.useState(false);
  const [newMachine, setNewMachine] = React.useState({
    code: "",
    name: "",
    machineType: "OTHER",
    ratedPowerW: "2500",
    annualOperatingHours: "1800",
    idleAlertThresholdMin: "15",
    hasPhysicalSensor: true,
  });

  const [testingTelegram, setTestingTelegram] = React.useState(false);
  const [telegramFeedback, setTelegramFeedback] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SettingsPayload | null) => {
        if (!active || !data) return;
        setDataSource(data.dataSource);
        setWorkshopName(data.workshop.name);
        setWorkshopLocation(data.workshop.location);
        setTariffIdr(String(data.workshop.tariffIdrPerKwh));
        setWorkingDays(String(data.workshop.workingDaysPerMonth));
        setTelegramChatId(data.workshop.telegramChatId);
        setMachines(data.machines);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveWorkshop(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workshopName,
          location: workshopLocation,
          tariffIdrPerKwh: Number(tariffIdr) || 1444.7,
          workingDaysPerMonth: Number(workingDays) || 26,
          telegramChatId: telegramChatId.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        persisted?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setProfileFeedback(data.error ?? "Gagal menyimpan.");
      } else {
        setProfileFeedback(
          data.persisted ? "Tersimpan." : "Tersimpan (Mode Demo)."
        );
      }
    } catch {
      setProfileFeedback("Koneksi gagal.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveEditMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMachine) return;
    setSavingMachine(true);

    try {
      await fetch(`/api/machines/${encodeURIComponent(editingMachine.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingMachine.name,
          ratedPowerW: editingMachine.ratedPowerW,
          annualOperatingHours: editingMachine.annualOperatingHours,
          portfolioQuadrant: editingMachine.portfolioQuadrant,
          hasPhysicalSensor: editingMachine.hasPhysicalSensor,
          idleAlertThresholdMin: editingMachine.idleAlertThresholdMin,
          isActive: editingMachine.isActive,
        }),
      });

      setMachines((prev) =>
        prev.map((m) => (m.id === editingMachine.id ? editingMachine : m))
      );
      setEditingMachine(null);
    } finally {
      setSavingMachine(false);
    }
  }

  async function handleCreateMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!newMachine.code.trim() || !newMachine.name.trim()) return;

    const ratedW = Math.max(100, Number(newMachine.ratedPowerW) || 2500);
    const hours = Math.max(10, Number(newMachine.annualOperatingHours) || 1500);
    const threshold = Math.max(1, Number(newMachine.idleAlertThresholdMin) || 15);
    const autoQ = classifyEnergyPortfolioQuadrant({
      ratedPowerW: ratedW,
      annualOperatingHours: hours,
    });

    const res = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newMachine.code.trim().toUpperCase(),
        name: newMachine.name.trim(),
        machineType: newMachine.machineType,
        ratedPowerW: ratedW,
        annualOperatingHours: hours,
        portfolioQuadrant: autoQ.quadrant,
        hasPhysicalSensor: newMachine.hasPhysicalSensor,
        idleAlertThresholdMin: threshold,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      machine?: SettingsMachineItem;
    };

    if (res.ok && data.machine) {
      setMachines((prev) => [...prev, data.machine!]);
      setAddOpen(false);
      setNewMachine({
        code: "",
        name: "",
        machineType: "OTHER",
        ratedPowerW: "2500",
        annualOperatingHours: "1800",
        idleAlertThresholdMin: "15",
        hasPhysicalSensor: true,
      });
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    setTelegramFeedback(null);
    try {
      const res = await fetch("/api/telegram/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idleReductionMinPerDay: 30,
          startupReductionPct: 35,
          projectedMonthlySavingIdr: 1_386_956,
          currentIdleLossIdr: 4_120_000,
          chatId: telegramChatId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: "live" | "simulated";
        error?: string;
      };
      if (res.ok && data.ok) {
        setTelegramFeedback(
          data.mode === "live"
            ? "Pesan uji coba terkirim."
            : "Terkirim (Mode Simulasi)."
        );
      } else {
        setTelegramFeedback(data.error ?? "Gagal mengirim.");
      }
    } finally {
      setTestingTelegram(false);
    }
  }

  const newMachinePreview = classifyEnergyPortfolioQuadrant({
    ratedPowerW: Number(newMachine.ratedPowerW) || 2500,
    annualOperatingHours: Number(newMachine.annualOperatingHours) || 1800,
  });

  return (
    <AppShell title="Pengaturan" dataSource={dataSource}>
      <Tabs defaultValue="machines" className="space-y-5">
        <TabsList className="h-9 bg-card p-1">
          <TabsTrigger value="machines" className="px-3 text-xs">
            <Sliders className="mr-1.5 size-3.5" />
            Mesin &amp; Portfolio
          </TabsTrigger>
          <TabsTrigger value="tariff" className="px-3 text-xs">
            <Zap className="mr-1.5 size-3.5" />
            Tarif Listrik
          </TabsTrigger>
          <TabsTrigger value="telegram" className="px-3 text-xs">
            <BellRing className="mr-1.5 size-3.5" />
            Telegram
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MESIN & MATRIX PORTFOLIO */}
        <TabsContent value="machines" className="space-y-5">
          <Skeleton loading={loading} id="settings-matrix" label="Memuat matriks">
            <MatrixEnergyPortfolio
              machines={machines}
              onSelectMachine={(m) => setEditingMachine({ ...m })}
            />
          </Skeleton>

          <Skeleton loading={loading} id="settings-table" label="Memuat mesin">
            <Card className="border-border/80 bg-card/90">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold text-white">
                  Daftar Mesin
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="bg-orange-600 text-xs font-semibold text-white hover:bg-orange-500"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Tambah
                </Button>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/70 hover:bg-transparent">
                        <TableHead className="text-[11px] uppercase">
                          Mesin
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Daya / Jam
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Kuadran
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Sensor
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Alert Idle
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machines.map((m) => {
                        const qb = QUADRANT_BADGE[m.portfolioQuadrant];
                        return (
                          <TableRow
                            key={m.id}
                            className="border-border/60 hover:bg-muted/30"
                          >
                            <TableCell>
                              <p className="text-xs font-semibold text-white">
                                {m.name}
                              </p>
                              <p className="font-mono text-[10px] text-zinc-500">
                                {m.code}
                              </p>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-200">
                              {m.ratedPowerW.toLocaleString("id-ID")} W
                              <span className="block text-[10px] text-zinc-500">
                                {m.annualOperatingHours.toLocaleString("id-ID")}{" "}
                                j/thn
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${qb.cls}`}
                              >
                                {qb.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {m.hasPhysicalSensor ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                                  <Radio className="size-3.5" />
                                  PZEM
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
                                  <Cpu className="size-3.5" />
                                  Virtual
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-amber-300">
                              {m.idleAlertThresholdMin} mnt
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingMachine({ ...m })}
                                className="h-7 px-2.5 text-xs"
                              >
                                <Pencil className="mr-1 size-3" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </Skeleton>
        </TabsContent>

        {/* TAB 2: TARIF LISTRIK */}
        <TabsContent value="tariff">
          <Card className="max-w-xl border-border/80 bg-card/90">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white">
                Bengkel &amp; Tarif PLN
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveWorkshop} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-name" className="text-xs text-zinc-400">
                      Nama Bengkel
                    </Label>
                    <Input
                      id="ws-name"
                      value={workshopName}
                      onChange={(e) => setWorkshopName(e.target.value)}
                      className="bg-background/70 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-loc" className="text-xs text-zinc-400">
                      Lokasi
                    </Label>
                    <Input
                      id="ws-loc"
                      value={workshopLocation}
                      onChange={(e) => setWorkshopLocation(e.target.value)}
                      className="bg-background/70 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="ws-tariff"
                      className="text-xs text-zinc-400"
                    >
                      Tarif (Rp / kWh)
                    </Label>
                    <Input
                      id="ws-tariff"
                      type="number"
                      step="0.01"
                      value={tariffIdr}
                      onChange={(e) => setTariffIdr(e.target.value)}
                      className="bg-background/70 font-mono text-sm"
                    />
                    <p className="font-mono text-[11px] text-zinc-500">
                      <TextMorph>
                        {`${formatRupiah(Number(tariffIdr) || 0)} / kWh`}
                      </TextMorph>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ws-days" className="text-xs text-zinc-400">
                      Hari Kerja / Bulan
                    </Label>
                    <Input
                      id="ws-days"
                      type="number"
                      min={1}
                      max={31}
                      value={workingDays}
                      onChange={(e) => setWorkingDays(e.target.value)}
                      className="bg-background/70 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {PLN_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTariffIdr(String(preset.value))}
                      className="h-7 text-[11px]"
                    >
                      {preset.label} • Rp {preset.value.toLocaleString("id-ID")}
                    </Button>
                  ))}
                </div>

                {profileFeedback && (
                  <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    {profileFeedback}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-orange-600 text-xs font-semibold text-white hover:bg-orange-500"
                >
                  <Save className="mr-1.5 size-3.5" />
                  <TextMorph>
                    {savingProfile ? "Menyimpan..." : "Simpan"}
                  </TextMorph>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: TELEGRAM */}
        <TabsContent value="telegram">
          <Card className="max-w-xl border-border/80 bg-card/90">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white">
                WattWise Bot
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tg-chat" className="text-xs text-zinc-400">
                  Chat ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="tg-chat"
                    placeholder="Contoh: 123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="bg-background/70 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSaveWorkshop()}
                    disabled={savingProfile}
                    className="shrink-0 bg-orange-600 text-xs font-semibold text-white hover:bg-orange-500"
                  >
                    <Save className="mr-1.5 size-3.5" />
                    Simpan
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 font-mono text-[11px] text-zinc-400 space-y-1">
                <p>Webhook: POST /api/telegram/webhook</p>
                <p>Perintah: /start • /status • /laporan</p>
                <p>Cooldown alert: 30 menit / mesin</p>
              </div>

              {profileFeedback && (
                <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {profileFeedback}
                </p>
              )}

              {telegramFeedback && (
                <p className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  {telegramFeedback}
                </p>
              )}

              <Button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="bg-sky-600 text-xs font-semibold text-white hover:bg-sky-500"
              >
                <Send className="mr-1.5 size-3.5" />
                <TextMorph>
                  {testingTelegram ? "Mengirim..." : "Uji Kirim Telegram"}
                </TextMorph>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Edit Mesin */}
      <Dialog
        open={Boolean(editingMachine)}
        onOpenChange={(open) => {
          if (!open) setEditingMachine(null);
        }}
      >
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          {editingMachine && (
            <form onSubmit={handleSaveEditMachine} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Edit — {editingMachine.code}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Nama Mesin</Label>
                  <Input
                    value={editingMachine.name}
                    onChange={(e) =>
                      setEditingMachine({
                        ...editingMachine,
                        name: e.target.value,
                      })
                    }
                    className="bg-background/70 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Daya (W)</Label>
                    <Input
                      type="number"
                      value={editingMachine.ratedPowerW}
                      onChange={(e) =>
                        setEditingMachine({
                          ...editingMachine,
                          ratedPowerW: Number(e.target.value) || 0,
                        })
                      }
                      className="bg-background/70 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Jam / Thn</Label>
                    <Input
                      type="number"
                      value={editingMachine.annualOperatingHours}
                      onChange={(e) =>
                        setEditingMachine({
                          ...editingMachine,
                          annualOperatingHours: Number(e.target.value) || 0,
                        })
                      }
                      className="bg-background/70 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Kuadran</Label>
                    <Select
                      value={editingMachine.portfolioQuadrant}
                      onValueChange={(val) => {
                        if (val) {
                          setEditingMachine({
                            ...editingMachine,
                            portfolioQuadrant: val as PortfolioQuadrant,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full bg-background/70 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">Kritis (II)</SelectItem>
                        <SelectItem value="LEVERAGE_POWER">Daya (I)</SelectItem>
                        <SelectItem value="LEVERAGE_TIME">Jam (III)</SelectItem>
                        <SelectItem value="NONCRITICAL">Virtual (IV)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">
                      Alert Idle (mnt)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={240}
                      value={editingMachine.idleAlertThresholdMin}
                      onChange={(e) =>
                        setEditingMachine({
                          ...editingMachine,
                          idleAlertThresholdMin: Number(e.target.value) || 15,
                        })
                      }
                      className="bg-background/70 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2.5">
                  <span className="text-xs text-zinc-200">
                    Sensor Fisik PZEM-004T
                  </span>
                  <Switch
                    checked={editingMachine.hasPhysicalSensor}
                    onCheckedChange={(checked) =>
                      setEditingMachine({
                        ...editingMachine,
                        hasPhysicalSensor: checked,
                      })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMachine(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={savingMachine}
                  className="bg-orange-600 text-white hover:bg-orange-500"
                >
                  <Check className="mr-1.5 size-3.5" />
                  Simpan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Mesin */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <form onSubmit={handleCreateMachine} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-white">Tambah Mesin</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Kode</Label>
                  <Input
                    required
                    placeholder="PLANER-01"
                    value={newMachine.code}
                    onChange={(e) =>
                      setNewMachine({ ...newMachine, code: e.target.value })
                    }
                    className="bg-background/70 font-mono text-sm uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Nama</Label>
                  <Input
                    required
                    placeholder="Planer Kayu"
                    value={newMachine.name}
                    onChange={(e) =>
                      setNewMachine({ ...newMachine, name: e.target.value })
                    }
                    className="bg-background/70 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Daya (W)</Label>
                  <Input
                    type="number"
                    min={100}
                    value={newMachine.ratedPowerW}
                    onChange={(e) =>
                      setNewMachine({
                        ...newMachine,
                        ratedPowerW: e.target.value,
                      })
                    }
                    className="bg-background/70 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Jam / Thn</Label>
                  <Input
                    type="number"
                    min={10}
                    value={newMachine.annualOperatingHours}
                    onChange={(e) =>
                      setNewMachine({
                        ...newMachine,
                        annualOperatingHours: e.target.value,
                      })
                    }
                    className="bg-background/70 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 px-3 py-2 text-xs text-orange-300">
                Rekomendasi: <strong>{newMachinePreview.label}</strong>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-orange-600 text-white hover:bg-orange-500"
              >
                <Plus className="mr-1.5 size-3.5" />
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
