"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  Check,
  Cpu,
  Database,
  Pencil,
  Plus,
  Radio,
  Save,
  Send,
  Settings2,
  Sliders,
  Zap,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

const PLN_TARIFF_PRESETS = [
  { label: "PLN B-2/TR (Bisnis Menengah)", value: 1444.7 },
  { label: "PLN I-3/TM (Industri Menengah)", value: 1114.74 },
  { label: "PLN B-3/TM (Bisnis Besar)", value: 1699.53 },
];

const QUADRANT_BADGE: Record<PortfolioQuadrant, { label: string; cls: string }> = {
  CRITICAL: {
    label: "Kuadran II • Kritis",
    cls: "border-rose-500/35 bg-rose-500/15 text-rose-300",
  },
  LEVERAGE_POWER: {
    label: "Kuadran I • Daya Tinggi",
    cls: "border-amber-500/35 bg-amber-500/15 text-amber-300",
  },
  LEVERAGE_TIME: {
    label: "Kuadran III • Jam Tinggi",
    cls: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  },
  NONCRITICAL: {
    label: "Kuadran IV • Virtual CT",
    cls: "border-sky-500/35 bg-sky-500/15 text-sky-300",
  },
};

export function SettingsShell() {
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

  // State modal edit mesin
  const [editingMachine, setEditingMachine] =
    React.useState<SettingsMachineItem | null>(null);
  const [savingMachine, setSavingMachine] = React.useState(false);

  // State modal tambah mesin baru
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

  // State uji Telegram
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
      .catch(() => {});

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
        setProfileFeedback(data.error ?? "Gagal menyimpan pengaturan.");
      } else {
        setProfileFeedback(
          data.persisted
            ? "Pengaturan bengkel & tarif berhasil disimpan ke PostgreSQL."
            : "Pengaturan diperbarui pada sesi demo (hubungkan DATABASE_URL untuk simpan permanen)."
        );
      }
    } catch {
      setProfileFeedback("Gagal menghubungi server pengaturan.");
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
            ? "Pesan uji coba berhasil terkirim ke Telegram!"
            : "Uji coba sukses (Mode Simulasi — isi TELEGRAM_BOT_TOKEN di .env untuk pengiriman nyata)."
        );
      } else {
        setTelegramFeedback(
          `Gagal kirim uji coba: ${data.error ?? "cek token & Chat ID"}`
        );
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
    <div className="min-h-screen bg-[#080b11] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-[#0b0f18]/90 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/dashboard" />}
              className="h-8 border-border/80 bg-background/70 text-xs text-zinc-200 hover:bg-muted"
            >
              <ArrowLeft className="mr-1.5 size-3.5" />
              Dashboard
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                <Settings2 className="size-4" />
              </div>
              <div className="leading-tight">
                <h1 className="text-sm font-bold text-white">
                  Pengaturan &amp; Manajemen Mesin
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Tarif Rp/kWh • Matrix Energy Portfolio • Alert Telegram
                </p>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className={
              dataSource === "database"
                ? "border-emerald-500/35 bg-emerald-500/10 text-[11px] text-emerald-300"
                : "border-sky-500/35 bg-sky-500/10 text-[11px] text-sky-300"
            }
          >
            <Database className="mr-1.5 size-3" />
            {dataSource === "database" ? "PostgreSQL Live" : "Mode Demo"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <Tabs defaultValue="machines" className="space-y-5">
          <TabsList className="h-9 bg-card p-1">
            <TabsTrigger value="machines" className="px-3.5 text-xs">
              <Sliders className="mr-1.5 size-3.5" />
              Manajemen Mesin &amp; Matrix Portfolio
            </TabsTrigger>
            <TabsTrigger value="tariff" className="px-3.5 text-xs">
              <Zap className="mr-1.5 size-3.5" />
              Profil Bengkel &amp; Tarif Listrik
            </TabsTrigger>
            <TabsTrigger value="telegram" className="px-3.5 text-xs">
              <BellRing className="mr-1.5 size-3.5" />
              Bot Telegram (WattWise Bot)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MANAJEMEN MESIN & MATRIX ENERGY PORTFOLIO */}
          <TabsContent value="machines" className="space-y-5">
            <MatrixEnergyPortfolio
              machines={machines}
              onSelectMachine={(m) => setEditingMachine({ ...m })}
            />

            <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25">
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white">
                    Daftar Mesin &amp; Ambang Batas Alert Idle
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Atur kapasitas daya nominal, kuadran prioritas sensor, dan
                    durasi ambang alert Telegram per mesin.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="bg-orange-600 text-xs font-semibold text-white hover:bg-orange-500"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Tambah Mesin
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
                          Daya &amp; Jam/Thn
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Matrix Portfolio
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Tipe Sensor
                        </TableHead>
                        <TableHead className="text-[11px] uppercase">
                          Ambang Idle
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
                              <p className="font-mono text-[10px] text-zinc-400">
                                {m.code}
                                {m.deviceUid ? ` • ${m.deviceUid}` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-200">
                              {m.ratedPowerW.toLocaleString("id-ID")} W
                              <span className="block text-[10px] text-zinc-500">
                                {m.annualOperatingHours.toLocaleString("id-ID")}{" "}
                                jam/thn
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
                                  PZEM-004T
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
                                  <Cpu className="size-3.5" />
                                  Virtual CT
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-amber-300">
                              &ge; {m.idleAlertThresholdMin} menit
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingMachine({ ...m })}
                                className="h-7 border-border/80 bg-background/70 px-2.5 text-xs"
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
          </TabsContent>

          {/* TAB 2: PROFIL BENGKEL & TARIF LISTRIK */}
          <TabsContent value="tariff">
            <Card className="max-w-2xl border-border/80 bg-card/90 shadow-lg shadow-black/25">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">
                  Profil Bengkel &amp; Tarif Listrik PLN
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Tarif Rp/kWh digunakan di seluruh kalkulasi kerugian daya
                  idle, Pareto, dan Simulator &ldquo;What-If&rdquo;.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSaveWorkshop} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ws-name" className="text-xs">
                        Nama Bengkel / Area Produksi
                      </Label>
                      <Input
                        id="ws-name"
                        value={workshopName}
                        onChange={(e) => setWorkshopName(e.target.value)}
                        className="bg-background/70 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ws-loc" className="text-xs">
                        Lokasi Bengkel
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
                      <Label htmlFor="ws-tariff" className="text-xs">
                        Tarif Listrik (Rp / kWh)
                      </Label>
                      <Input
                        id="ws-tariff"
                        type="number"
                        step="0.01"
                        value={tariffIdr}
                        onChange={(e) => setTariffIdr(e.target.value)}
                        className="bg-background/70 font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Aktif: {formatRupiah(Number(tariffIdr) || 0)} / kWh
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ws-days" className="text-xs">
                        Hari Kerja per Bulan
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
                      <p className="text-[11px] text-muted-foreground">
                        Dipakai untuk proyeksi penghematan bulanan
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
                    <p className="text-[11px] font-medium text-zinc-300">
                      Preset Golongan Tarif PLN UMKM:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PLN_TARIFF_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setTariffIdr(String(preset.value))}
                          className="h-7 border-border/80 bg-card text-[11px]"
                        >
                          {preset.label} — Rp{" "}
                          {preset.value.toLocaleString("id-ID")}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {profileFeedback && (
                    <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      {profileFeedback}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-orange-600 text-xs font-semibold text-white hover:bg-orange-500"
                  >
                    <Save className="mr-1.5 size-3.5" />
                    {savingProfile ? "Menyimpan..." : "Simpan Pengaturan"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: BOT TELEGRAM */}
          <TabsContent value="telegram">
            <Card className="max-w-2xl border-border/80 bg-card/90 shadow-lg shadow-black/25">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">
                  Konfigurasi WattWise Bot (Telegram)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Penerima laporan hemat energi berkala dan notifikasi urgent
                  ketika mesin melewati ambang durasi idle (dengan cooldown
                  anti-spam 30 menit).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="tg-chat" className="text-xs">
                    Telegram Chat ID (Pemilik / Grup Teknisi)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="tg-chat"
                      placeholder="Contoh: 123456789 atau -1001987654321"
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

                <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-4 text-xs text-zinc-300">
                  <p className="font-semibold text-white">
                    Panduan Cepat Aktivasi Bot:
                  </p>
                  <ol className="list-decimal space-y-1.5 pl-4 text-zinc-400">
                    <li>
                      Buat bot melalui{" "}
                      <span className="font-mono text-zinc-200">@BotFather</span>{" "}
                      dan masukkan token ke{" "}
                      <span className="font-mono text-zinc-200">
                        TELEGRAM_BOT_TOKEN
                      </span>{" "}
                      pada file <span className="font-mono">.env</span>.
                    </li>
                    <li>
                      Kirim pesan <span className="font-mono">/start</span> ke
                      bot Anda lalu ambil Chat ID melalui{" "}
                      <span className="font-mono text-zinc-200">
                        @userinfobot
                      </span>{" "}
                      dan tempelkan di kolom di atas.
                    </li>
                    <li>
                      Daftarkan webhook ke endpoint{" "}
                      <span className="font-mono text-sky-300">
                        POST /api/telegram/webhook
                      </span>{" "}
                      agar perintah <span className="font-mono">/status</span>{" "}
                      &amp; <span className="font-mono">/laporan</span> aktif.
                    </li>
                  </ol>
                </div>

                {profileFeedback && (
                  <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    {profileFeedback}
                  </div>
                )}

                {telegramFeedback && (
                  <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                    {telegramFeedback}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram}
                  className="bg-sky-600 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  {testingTelegram ? (
                    "Mengirim Uji Coba..."
                  ) : (
                    <>
                      <Send className="mr-1.5 size-3.5" />
                      Kirim Pesan Uji Coba ke Telegram
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

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
                  Edit Mesin — {editingMachine.code}
                </DialogTitle>
                <DialogDescription>
                  Sesuaikan daya nominal, kuadran Matrix Energy Portfolio, dan
                  ambang durasi alert idle.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama Mesin</Label>
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
                    <Label className="text-xs">Daya Nominal (W)</Label>
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
                    <Label className="text-xs">Jam Operasi / Thn</Label>
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
                    <Label className="text-xs">Kuadran Portfolio</Label>
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
                        <SelectItem value="CRITICAL">
                          Kuadran II (Kritis)
                        </SelectItem>
                        <SelectItem value="LEVERAGE_POWER">
                          Kuadran I (Daya Tinggi)
                        </SelectItem>
                        <SelectItem value="LEVERAGE_TIME">
                          Kuadran III (Jam Tinggi)
                        </SelectItem>
                        <SelectItem value="NONCRITICAL">
                          Kuadran IV (Noncritical)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Ambang Alert Idle (mnt)</Label>
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
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      Pasang Sensor Fisik PZEM-004T
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Matikan untuk memantau via agregasi Virtual Sensor
                    </p>
                  </div>
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
                  {savingMachine ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Mesin Baru */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <form onSubmit={handleCreateMachine} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-white">
                Tambah Mesin Bengkel Baru
              </DialogTitle>
              <DialogDescription>
                Kuadran Matrix Energy Portfolio dihitung otomatis dari daya
                nominal dan estimasi jam operasi tahunan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kode Mesin</Label>
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
                  <Label className="text-xs">Nama Mesin</Label>
                  <Input
                    required
                    placeholder="Mesin Planer Kayu"
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
                  <Label className="text-xs">Daya Nominal (W)</Label>
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
                  <Label className="text-xs">Jam Operasi / Thn</Label>
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

              <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-3 text-xs">
                <p className="font-semibold text-orange-300">
                  Rekomendasi Otomatis: {newMachinePreview.label}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {newMachinePreview.description}
                </p>
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
                Simpan Mesin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
