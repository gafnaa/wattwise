"use client";

import * as React from "react";
import {
  CheckCircle2,
  Cpu,
  Database,
  Loader2,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { SettingsPayload } from "@/app/api/settings/route";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserBlobatar } from "@/components/ui/user-blobatar";
import { StatusPill } from "@/components/ui/wattwise-badges";

type SettingsTab = "profil" | "notifikasi" | "pengguna" | "integrasi";

interface HealthPayload {
  database: string;
  mlModel: {
    modelType: string;
    standard: string;
    nEstimators: number;
  };
  aiAdvisor?: {
    configured: boolean;
    provider: string;
    model: string | null;
  };
  telegram: {
    configured: boolean;
  };
}

export function SettingsShell() {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profil");
  const [dataSource, setDataSource] = React.useState<"database" | "demo">(
    "database"
  );
  const [workshopCode, setWorkshopCode] = React.useState("WS-SKH-01");
  const [name, setName] = React.useState("Area Produksi Furnitur — Sukoharjo");
  const [location, setLocation] = React.useState(
    "Sentra Mebel Trangsan, Kab. Sukoharjo, Jawa Tengah"
  );
  const [tariff, setTariff] = React.useState("1444.7");
  const [workingDays, setWorkingDays] = React.useState("26");
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [health, setHealth] = React.useState<HealthPayload | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [lastSavedText, setLastSavedText] = React.useState(
    "Sinkron dengan Supabase PostgreSQL"
  );
  const [testingTg, setTestingTg] = React.useState(false);
  const [tgFeedback, setTgFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/settings", { cache: "no-store" }).then((r) =>
        r.ok ? (r.json() as Promise<SettingsPayload>) : null
      ),
      fetch("/api/health", { cache: "no-store" }).then((r) =>
        r.ok ? (r.json() as Promise<HealthPayload>) : null
      ),
    ])
      .then(([settingsData, healthData]) => {
        if (!active) return;
        if (settingsData) {
          setDataSource(settingsData.dataSource);
          setWorkshopCode(settingsData.workshop.code);
          setName(settingsData.workshop.name);
          setLocation(settingsData.workshop.location);
          setTariff(String(settingsData.workshop.tariffIdrPerKwh));
          setWorkingDays(String(settingsData.workshop.workingDaysPerMonth));
          setTelegramChatId(settingsData.workshop.telegramChatId ?? "");
        }
        if (healthData) setHealth(healthData);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          tariffIdrPerKwh: Number(tariff) || 1444.7,
          workingDaysPerMonth: Number(workingDays) || 26,
          telegramChatId: telegramChatId.trim(),
        }),
      });
      if (res.ok) {
        const ts = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setLastSavedText(`Perubahan terakhir disimpan pukul ${ts} WIB`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTestTelegram() {
    setTestingTg(true);
    setTgFeedback(null);
    try {
      const res = await fetch("/api/telegram/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idleReductionMinPerDay: 30,
          startupReductionPct: 35,
          projectedMonthlySavingIdr: 486166,
          currentIdleLossIdr: 227658,
          chatId: telegramChatId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; mode?: string };
      setTgFeedback(
        json.ok
          ? `Pesan tes terkirim ke Telegram (${json.mode === "live" ? "Live" : "Simulasi"}).`
          : "Gagal mengirim pesan tes."
      );
    } finally {
      setTestingTg(false);
    }
  }

  const wbpTariff = ((Number(tariff) || 1444.7) * 1.5).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AppShell
      title="Pengaturan"
      section="Manajemen"
      dataSource={dataSource}
      workshopName={name}
    >
      <div className="space-y-6 sm:space-y-7">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]">
              Pengaturan
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              Profil usaha, tarif listrik PLN, notifikasi Telegram, dan
              integrasi sistem
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSaveSettings}
            className="h-9 gap-1.5 self-start rounded-lg bg-[#059669] px-4 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#047857] sm:self-auto"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Simpan perubahan</span>
          </Button>
        </div>

        {/* Tabs Row (mobile horizontal scroll) + Last Saved */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="no-scrollbar flex max-w-full overflow-x-auto">
            <div className="inline-flex shrink-0 rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
              {(
                [
                  ["profil", "Profil & Tarif"],
                  ["notifikasi", "Notifikasi"],
                  ["pengguna", "Pengguna & Akses"],
                  ["integrasi", "Integrasi"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                    activeTab === key
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{lastSavedText}</p>
        </div>

        {/* Tab 1: Profil & Tarif (Exact Figma 2-Col Cards) */}
        {activeTab === "profil" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                Profil Usaha
              </h3>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Nama usaha / workshop
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Lokasi
                  </Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Hari kerja per bulan (Senin–Sabtu)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={workingDays}
                    onChange={(e) => setWorkingDays(e.target.value)}
                    className="h-10 rounded-lg border-border bg-card font-mono text-[13px]"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                Tarif Listrik PLN
              </h3>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Kode workshop & golongan tarif
                  </Label>
                  <Input
                    value={`${workshopCode} · I-2 / B-2 Tegangan Rendah`}
                    readOnly
                    className="h-10 rounded-lg border-border bg-muted/40 text-[13px] text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Tarif dasar LWBP (Rp / kWh)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tariff}
                    onChange={(e) => setTariff(e.target.value)}
                    className="h-10 rounded-lg border-border bg-card font-mono text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Estimasi tarif WBP 17.00–22.00 (1,5x)
                  </Label>
                  <Input
                    value={`Rp ${wbpTariff} / kWh`}
                    readOnly
                    className="h-10 rounded-lg border-border bg-muted/40 font-mono text-[13px] text-muted-foreground"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Notifikasi Telegram */}
        {activeTab === "notifikasi" && (
          <section className="max-w-2xl rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Notifikasi & WattWise Telegram Bot
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alert otomatis saat mesin idle lewat batas (cooldown 30 menit)
                  & tanya-jawab AI via @wattwise_smart_bot
                </p>
              </div>
              <StatusPill
                label={health?.telegram.configured ? "Aktif" : "Belum diset"}
                tone={health?.telegram.configured ? "green" : "amber"}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Telegram Chat ID Penerima
                </Label>
                <Input
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Contoh: 8029588270"
                  className="h-10 rounded-lg border-border bg-card font-mono text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Klik Simpan perubahan di kanan atas setelah mengubah Chat ID.
                </p>
              </div>

              {tgFeedback && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-[#ECFDF5] px-3 py-2 text-xs text-[#047857] dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>{tgFeedback}</span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingTg}
                onClick={handleTestTelegram}
                className="h-9 gap-1.5 rounded-lg text-xs font-medium"
              >
                {testingTg ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span>Kirim Pesan Tes ke Telegram</span>
              </Button>
            </div>
          </section>
        )}

        {/* Tab 3: Pengguna & Akses */}
        {activeTab === "pengguna" && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              Pengguna & Hak Akses
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Akun terdaftar pada workshop {name}
            </p>
            <div className="mt-4 divide-y divide-border/70 text-xs">
              {[
                {
                  name: "Pemilik Pabrik",
                  username: "owner",
                  role: "OWNER",
                  desc: "Akses penuh audit energi, pengaturan tarif, dan laporan AI",
                },
                {
                  name: "Teknisi Bengkel",
                  username: "teknisi",
                  role: "TECHNICIAN",
                  desc: "Monitoring real-time mesin, perangkat ESP32, dan log tindakan",
                },
              ].map((u) => (
                <div
                  key={u.username}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <UserBlobatar
                      name={`wattwise-${u.username}`}
                      size={36}
                      shape="circle"
                      title={u.name}
                    />
                    <div>
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        @{u.username} · {u.desc}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    label={u.role === "OWNER" ? "Pemilik" : "Teknisi"}
                    tone={u.role === "OWNER" ? "emerald" : "blue"}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 4: Integrasi */}
        {activeTab === "integrasi" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                icon: Database,
                title: "Supabase PostgreSQL",
                detail:
                  health?.database === "connected"
                    ? "Terhubung via Prisma 7 + Pooler"
                    : "Mode fallback demo",
                ok: health?.database === "connected",
              },
              {
                icon: Cpu,
                title: "Random Forest Classifier",
                detail: health
                  ? `${health.mlModel.standard} · ${health.mlModel.nEstimators} decision trees`
                  : "ISO 14955-5:2020",
                ok: true,
              },
              {
                icon: Sparkles,
                title: "Generative AI Advisor",
                detail: health?.aiAdvisor?.configured
                  ? `${health.aiAdvisor.provider} · ${health.aiAdvisor.model}`
                  : "Rule-based fallback aktif",
                ok: Boolean(health?.aiAdvisor?.configured),
              },
              {
                icon: ShieldCheck,
                title: "Telegram Bot 2 Arah",
                detail: health?.telegram.configured
                  ? "@wattwise_smart_bot aktif (alert + chat bebas AI)"
                  : "Token atau Chat ID belum lengkap",
                ok: Boolean(health?.telegram.configured),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    label={item.ok ? "Aktif" : "Fallback"}
                    tone={item.ok ? "green" : "amber"}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
