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
  PanelLeftClose,
  PanelLeftOpen,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  { href: "/dashboard", label: "Ringkasan", shortLabel: "Ringkas", icon: LayoutGrid },
  { href: "/machines", label: "Monitoring Mesin", shortLabel: "Mesin", icon: Activity },
  { href: "/analytics", label: "Analisis Energi", shortLabel: "Analisis", icon: BarChart3 },
  {
    href: "/actions",
    label: "Rekomendasi AI",
    shortLabel: "AI",
    icon: Sparkles,
    showBadge: true,
  },
  { href: "/reports", label: "Laporan", shortLabel: "Laporan", icon: FileText },
] as const;

const MANAGEMENT_NAV = [
  { href: "/management/machines", label: "Manajemen Mesin", icon: Cpu },
  { href: "/devices", label: "Perangkat IoT", icon: Radio },
  { href: "/settings", label: "Pengaturan", icon: SlidersHorizontal },
] as const;

const MOBILE_BOTTOM_NAV = [
  MAIN_NAV[0],
  MAIN_NAV[1],
  MAIN_NAV[2],
  MAIN_NAV[3],
] as const;

const RANGE_LABELS: Record<DateRangeKey, string> = {
  month: "30 Hari",
  week: "7 Hari",
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
          workshopName:
            me.user?.workshopName ?? prev?.workshopName ?? workshopName,
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

  function renderDesktopNavItem(item: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    showBadge?: boolean;
  }) {
    const Icon = item.icon;
    const active = isNavActive(item.href);

    const linkEl = (
      <Link
        key={item.href}
        href={item.href}
        aria-label={collapsed ? item.label : undefined}
        className={`relative flex items-center rounded-lg text-[13px] font-medium transition-colors ${
          collapsed
            ? "mx-auto size-10 justify-center p-0"
            : "justify-between gap-2.5 px-2.5 py-2"
        } ${
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
          {!collapsed && <span className="truncate">{item.label}</span>}
        </span>

        {!collapsed && item.showBadge && effectivePending > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F5F3FF] px-1.5 text-[11.5px] font-semibold text-[#6D28D9] tabular-nums dark:bg-violet-950/70 dark:text-violet-300">
            {effectivePending}
          </span>
        )}
        {collapsed && item.showBadge && effectivePending > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#6D28D9] ring-2 ring-sidebar" />
        )}
      </Link>
    );

    if (!collapsed) return linkEl;

    return (
      <Tooltip key={item.href}>
        <TooltipTrigger render={linkEl} />
        <TooltipContent side="right" className="text-xs">
          {item.label}
          {item.showBadge && effectivePending > 0
            ? ` (${effectivePending})`
            : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar (256px expanded, 68px clean icon rail collapsed — zero overlap!) */}
      <aside
        className={`hidden shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:block ${
          collapsed ? "w-[68px]" : "w-[256px]"
        }`}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          {/* Brand Row: strictly separated collapsed vs expanded layout */}
          <div
            className={`flex h-16 shrink-0 items-center border-b border-border/60 ${
              collapsed ? "justify-center px-2" : "justify-between gap-2 px-4"
            }`}
          >
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2.5"
              title="WattWise — Energy Intelligence"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669] text-white shadow-xs">
                <Zap className="size-4 fill-white" />
              </div>
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                    WattWise
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    Energy Intelligence
                  </p>
                </div>
              )}
            </Link>

            {!collapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Sembunyikan sidebar"
                title="Sembunyikan sidebar"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            )}
          </div>

          {/* Nav Groups */}
          <nav
            className={`flex-1 overflow-y-auto py-3 ${
              collapsed ? "space-y-4 px-2" : "space-y-5 px-3"
            }`}
          >
            <div>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Menu Utama
                </p>
              )}
              <div className="space-y-0.5">
                {MAIN_NAV.map((item) => renderDesktopNavItem(item))}
              </div>
            </div>

            <div className={collapsed ? "border-t border-border/60 pt-3" : ""}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Manajemen
                </p>
              )}
              <div className="space-y-0.5">
                {MANAGEMENT_NAV.map((item) => renderDesktopNavItem(item))}
              </div>
            </div>
          </nav>

          {/* Footer Stack */}
          <div
            className={`shrink-0 border-t border-border ${
              collapsed ? "space-y-2 p-2" : "space-y-3 p-3"
            }`}
          >
            {!collapsed && (
              <div
                className={
                  dataSource === "demo"
                    ? "rounded-xl border border-amber-200 bg-[#FFFBEB] p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/35"
                    : "rounded-xl border border-emerald-200/80 bg-[#ECFDF5] p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/35"
                }
              >
                <div
                  className={`flex items-center gap-1.5 font-semibold ${
                    dataSource === "demo"
                      ? "text-[#92400E] dark:text-amber-300"
                      : "text-[#065F46] dark:text-emerald-300"
                  }`}
                >
                  <Info className="size-3.5 shrink-0" />
                  <span>
                    {dataSource === "demo" ? "Mode Simulasi" : "Live Supabase"}
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    dataSource === "demo"
                      ? "text-[#92400E]/85 dark:text-amber-200/80"
                      : "text-[#065F46]/85 dark:text-emerald-200/80"
                  }`}
                >
                  {dataSource === "demo"
                    ? "Menampilkan baseline workshop pilot."
                    : "Sensor, RF ISO 14955-5 & Gemini AI aktif."}
                </p>
              </div>
            )}

            {/* Theme Switcher */}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() =>
                        setTheme(theme === "light" ? "dark" : "light")
                      }
                      className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Ganti tema terang atau gelap"
                    >
                      {theme === "light" ? (
                        <Moon className="size-4" />
                      ) : (
                        <Sun className="size-4" />
                      )}
                    </button>
                  }
                />
                <TooltipContent side="right" className="text-xs">
                  {theme === "light" ? "Mode Gelap" : "Mode Terang"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${
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
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${
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

            {/* Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={`flex w-full items-center rounded-lg transition-colors hover:bg-muted ${
                      collapsed
                        ? "justify-center p-1"
                        : "justify-between gap-2.5 p-1.5 text-left"
                    }`}
                    aria-label="Menu akun"
                  />
                }
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-xs font-semibold text-[#047857] dark:bg-emerald-950 dark:text-emerald-300">
                    {getInitials(effectiveWorkshop)}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {effectiveWorkshop}
                      </p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {effectiveOwner} · {effectiveRole}
                      </p>
                    </div>
                  )}
                </div>
                {!collapsed && (
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
      </aside>

      {/* Mobile Full Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col bg-sidebar shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669] text-white">
                  <Zap className="size-4 fill-white" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-foreground">
                    WattWise
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Energy Intelligence
                  </p>
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="size-9"
                aria-label="Tutup menu"
              >
                <X className="size-4" />
              </Button>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              <div>
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Menu Utama
                </p>
                <div className="space-y-1">
                  {MAIN_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                          active
                            ? "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/70 dark:text-emerald-300"
                            : "text-zinc-700 hover:bg-muted dark:text-zinc-300"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        {"showBadge" in item &&
                          item.showBadge &&
                          effectivePending > 0 && (
                            <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-xs font-semibold text-[#6D28D9] dark:bg-violet-950 dark:text-violet-300">
                              {effectivePending}
                            </span>
                          )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Manajemen
                </p>
                <div className="space-y-1">
                  {MANAGEMENT_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                          active
                            ? "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/70 dark:text-emerald-300"
                            : "text-zinc-700 hover:bg-muted dark:text-zinc-300"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>

            <div className="space-y-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-md font-medium ${
                    theme === "light"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground"
                  }`}
                >
                  <Sun className="size-3.5" />
                  <span>Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-md font-medium ${
                    theme === "dark"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground"
                  }`}
                >
                  <Moon className="size-3.5" />
                  <span>Gelap</span>
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="h-10 w-full justify-center gap-2 text-xs text-[#DC2626]"
              >
                <LogOut className="size-3.5" />
                <span>Keluar ({effectiveOwner})</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Bar (Zero duplicate page heading!) */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Desktop Expand Trigger — ONLY visible when rail is collapsed */}
            {collapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="hidden size-8 shrink-0 text-muted-foreground hover:text-foreground lg:inline-flex"
                aria-label="Tampilkan sidebar"
                title="Tampilkan sidebar"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}

            {/* Mobile brand + drawer trigger */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="size-9 shrink-0 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="size-4" />
            </Button>

            {/* Mobile compact title */}
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#059669] text-white">
                <Zap className="size-3.5 fill-white" />
              </div>
              <span className="truncate text-sm font-semibold text-foreground">
                {title}
              </span>
            </div>

            {/* Desktop clean breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex"
            >
              <Link
                href="/dashboard"
                className="transition-colors hover:text-foreground"
              >
                WattWise
              </Link>
              <ChevronRight className="size-3.5 text-zinc-400" />
              <span>{section}</span>
              <ChevronRight className="size-3.5 text-zinc-400" />
              <span className="font-medium text-foreground">{title}</span>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Hardware Connectivity Pill */}
            <Link
              href="/devices"
              className="hidden items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1.5 text-xs font-medium text-[#047857] ring-1 ring-inset ring-emerald-600/15 transition-colors hover:bg-emerald-100 md:inline-flex dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-400/20"
            >
              <span className="size-1.5 rounded-full bg-[#16A34A]" />
              <span className="tabular-nums">
                Terhubung · {effectiveOnline}/{effectiveTotal}
              </span>
            </Link>

            {/* Period Selector */}
            {onRangeChange && (
              <Select
                value={range}
                onValueChange={(val) => {
                  if (val === "month" || val === "week" || val === "today") {
                    onRangeChange(val);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[124px] rounded-lg border-border bg-card text-xs font-medium sm:w-[144px]">
                  <Calendar className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{RANGE_LABELS.month}</SelectItem>
                  <SelectItem value="week">{RANGE_LABELS.week}</SelectItem>
                  <SelectItem value="today">{RANGE_LABELS.today}</SelectItem>
                </SelectContent>
              </Select>
            )}

            {headerActions}

            <Link
              href="/actions"
              className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Rekomendasi AI"
            >
              <Bell className="size-4" />
              {effectivePending > 0 && (
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#DC2626]" />
              )}
            </Link>

            <Link
              href="/settings"
              className="hidden size-9 items-center justify-center rounded-full bg-[#ECFDF5] text-xs font-semibold text-[#047857] ring-1 ring-emerald-600/20 transition-colors hover:bg-emerald-100 sm:flex dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/25"
              title={`${effectiveOwner} · Pengaturan`}
            >
              {getInitials(effectiveOwner)}
            </Link>
          </div>
        </header>

        {/* Main Workspace Canvas (safe-area + mobile bottom nav clearance) */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-7 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb-reachable, 44px+ targets) */}
      <nav
        aria-label="Navigasi utama mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        {MOBILE_BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                active
                  ? "text-[#047857] dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{item.shortLabel}</span>
              {"showBadge" in item && item.showBadge && effectivePending > 0 && (
                <span className="absolute top-1.5 right-3.5 size-1.5 rounded-full bg-[#6D28D9]" />
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-4" />
          <span>Lainnya</span>
        </button>
      </nav>
    </div>
  );
}
