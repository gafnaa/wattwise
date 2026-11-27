"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  FileText,
  Info,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  Radio,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useWattWiseTheme } from "@/components/providers/app-providers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRangeKey } from "@/lib/mock-dashboard-data";

export interface AppShellProps {
  title: string;
  section?: "Menu Utama" | "Manajemen";
  dataSource?: "database" | "demo";
  workshopName?: string;
  ownerName?: string;
  ownerRole?: string;
  onlineDevices?: number;
  totalDevices?: number;
  pendingRecommendationsCount?: number;
  range?: DateRangeKey;
  onRangeChange?: (range: DateRangeKey) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const MAIN_NAV = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutGrid },
  { href: "/machines", label: "Monitoring Mesin", icon: Activity },
  { href: "/analytics", label: "Analisis Energi", icon: BarChart3 },
  {
    href: "/actions",
    label: "Rekomendasi AI",
    icon: Sparkles,
    showBadge: true,
  },
  { href: "/reports", label: "Laporan", icon: FileText },
] as const;

const MANAGEMENT_NAV = [
  { href: "/management/machines", label: "Manajemen Mesin", icon: Cpu },
  { href: "/devices", label: "Perangkat IoT", icon: Radio },
  { href: "/settings", label: "Pengaturan", icon: SlidersHorizontal },
] as const;

const RANGE_LABELS: Record<DateRangeKey, string> = {
  month: "30 Hari Terakhir",
  week: "7 Hari Terakhir",
  today: "Hari Ini",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "WW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AppShell({
  title,
  section = "Menu Utama",
  dataSource = "database",
  workshopName = "Area Produksi Furnitur",
  ownerName = "Pemilik Pabrik",
  ownerRole = "Pemilik",
  onlineDevices = 6,
  totalDevices = 7,
  pendingRecommendationsCount,
  range = "month",
  onRangeChange,
  headerActions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useWattWiseTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [liveMeta, setLiveMeta] = React.useState<{
    workshopName: string;
    ownerName: string;
    ownerRole: string;
    onlineDevices: number;
    totalDevices: number;
    pendingCount: number;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!active || !me) return;
        setLiveMeta((prev) => ({
          workshopName: me.user?.workshopName ?? prev?.workshopName ?? workshopName,
          ownerName: me.user?.fullName ?? prev?.ownerName ?? ownerName,
          ownerRole:
            me.user?.role === "TECHNICIAN"
              ? "Teknisi"
              : me.user?.role === "ADMIN"
                ? "Admin"
                : "Pemilik",
          onlineDevices: me.hardwareStatus?.esp32Online ?? onlineDevices,
          totalDevices: me.hardwareStatus?.esp32Total ?? totalDevices,
          pendingCount: prev?.pendingCount ?? pendingRecommendationsCount ?? 0,
        }));
      })
      .catch(() => null);

    if (pendingRecommendationsCount === undefined) {
      fetch("/api/recommendations?status=PENDING", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((rec) => {
          if (!active || !rec) return;
          const count = Array.isArray(rec.recommendations)
            ? rec.recommendations.length
            : 0;
          setLiveMeta((prev) => ({
            workshopName: prev?.workshopName ?? workshopName,
            ownerName: prev?.ownerName ?? ownerName,
            ownerRole: prev?.ownerRole ?? ownerRole,
            onlineDevices: prev?.onlineDevices ?? onlineDevices,
            totalDevices: prev?.totalDevices ?? totalDevices,
            pendingCount: count,
          }));
        })
        .catch(() => null);
    }

    return () => {
      active = false;
    };
  }, [
    onlineDevices,
    ownerName,
    ownerRole,
    pendingRecommendationsCount,
    totalDevices,
    workshopName,
  ]);

  const effectiveWorkshop = liveMeta?.workshopName ?? workshopName;
  const effectiveOwner = liveMeta?.ownerName ?? ownerName;
  const effectiveRole = liveMeta?.ownerRole ?? ownerRole;
  const effectiveOnline = liveMeta?.onlineDevices ?? onlineDevices;
  const effectiveTotal = liveMeta?.totalDevices ?? totalDevices;
  const effectivePending =
    pendingRecommendationsCount ?? liveMeta?.pendingCount ?? 0;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  function isNavActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/machines") return pathname === "/machines";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebarNavContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* Brand Row */}
      <div className="flex h-[72px] shrink-0 items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => isMobile && setMobileOpen(false)}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669] text-white shadow-xs">
            <Zap className="size-4 fill-white" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                WattWise
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Energy Intelligence
              </p>
            </div>
          )}
        </Link>
        {!isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((v) => !v)}
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        <div>
          {(!collapsed || isMobile) && (
            <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              Menu Utama
            </p>
          )}
          <div className="space-y-0.5">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={`flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`size-4 shrink-0 ${
                        active
                          ? "text-[#059669] dark:text-emerald-400"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    />
                    {(!collapsed || isMobile) && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </span>
                  {(!collapsed || isMobile) &&
                    "showBadge" in item &&
                    item.showBadge &&
                    effectivePending > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F5F3FF] px-1.5 text-[11px] font-semibold text-[#6D28D9] tabular-nums dark:bg-violet-950/70 dark:text-violet-300">
                        {effectivePending}
                      </span>
                    )}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          {(!collapsed || isMobile) && (
            <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              Manajemen
            </p>
          )}
          <div className="space-y-0.5">
            {MANAGEMENT_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`size-4 shrink-0 ${
                      active
                        ? "text-[#059669] dark:text-emerald-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  />
                  {(!collapsed || isMobile) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Footer Stack */}
      <div className="shrink-0 space-y-3 border-t border-border p-3">
        {(!collapsed || isMobile) && (
          <div
            className={
              dataSource === "demo"
                ? "rounded-xl border border-amber-200/80 bg-[#FFFBEB] p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30"
                : "rounded-xl border border-emerald-200/80 bg-[#ECFDF5] p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30"
            }
          >
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                dataSource === "demo"
                  ? "text-[#B45309] dark:text-amber-300"
                  : "text-[#047857] dark:text-emerald-300"
              }`}
            >
              <Info className="size-3.5 shrink-0" />
              <span>{dataSource === "demo" ? "Mode Demo" : "Terhubung Live"}</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {dataSource === "demo"
                ? "Sebagian data menggunakan simulasi baseline."
                : "Database Supabase & AI Advisor aktif real-time."}
            </p>
          </div>
        )}

        {/* Theme Switcher: Terang / Gelap */}
        {(!collapsed || isMobile) && (
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
                theme === "light"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="size-3.5" />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
                theme === "dark"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="size-3.5" />
              <span>Gelap</span>
            </button>
          </div>
        )}

        {/* Workspace / Owner Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted"
              />
            }
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-xs font-semibold text-[#047857] dark:bg-emerald-950 dark:text-emerald-300">
                {getInitials(effectiveWorkshop)}
              </div>
              {(!collapsed || isMobile) && (
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {effectiveWorkshop}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {effectiveOwner} · {effectiveRole}
                  </p>
                </div>
              )}
            </div>
            {(!collapsed || isMobile) && (
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {effectiveOwner} ({effectiveRole})
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<Link href="/settings" />}
                className="text-xs"
              >
                <Settings className="mr-2 size-3.5" />
                Pengaturan Workshop
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                className="text-xs"
              >
                <LogOut className="mr-2 size-3.5" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 lg:block ${
          collapsed ? "w-[72px]" : "w-[256px]"
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarNavContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-[264px] max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Tutup menu"
            >
              <X className="size-4" />
            </button>
            {sidebarNavContent(true)}
          </div>
        </div>
      )}

      {/* Right Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header (72px) */}
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="size-8 lg:hidden"
              aria-label="Buka navigasi"
            >
              <Menu className="size-4" />
            </Button>

            <div className="min-w-0">
              <div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                <span>WattWise</span>
                <ChevronRight className="size-3" />
                <span>{section}</span>
                <ChevronRight className="size-3" />
                <span className="font-medium text-foreground">{title}</span>
              </div>
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-foreground sm:text-[20px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {/* Device Status Pill */}
            <Link
              href="/devices"
              className="hidden items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1.5 text-xs font-medium text-[#047857] transition-colors hover:bg-emerald-100 md:inline-flex dark:bg-emerald-950/70 dark:text-emerald-300"
            >
              <span className="size-1.5 rounded-full bg-[#16A34A]" />
              <span>
                Terhubung · {effectiveOnline}/{effectiveTotal} perangkat
              </span>
            </Link>

            {/* Period Selector */}
            {onRangeChange ? (
              <Select
                value={range}
                onValueChange={(val) => {
                  if (val === "month" || val === "week" || val === "today") {
                    onRangeChange(val);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[158px] rounded-lg border-border bg-card text-xs font-medium">
                  <Calendar className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{RANGE_LABELS.month}</SelectItem>
                  <SelectItem value="week">{RANGE_LABELS.week}</SelectItem>
                  <SelectItem value="today">{RANGE_LABELS.today}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground sm:inline-flex">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{RANGE_LABELS[range]}</span>
              </div>
            )}

            {headerActions}

            {/* Bell */}
            <Link
              href="/actions"
              className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Rekomendasi dan notifikasi"
            >
              <Bell className="size-4" />
              {effectivePending > 0 && (
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#DC2626]" />
              )}
            </Link>

            {/* User Avatar */}
            <Link
              href="/settings"
              className="flex size-9 items-center justify-center rounded-full bg-[#ECFDF5] text-xs font-semibold text-[#047857] ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800"
              title={`${effectiveOwner} · Pengaturan`}
            >
              {getInitials(effectiveOwner)}
            </Link>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
