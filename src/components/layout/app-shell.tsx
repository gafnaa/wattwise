"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { WORKSHOP_INFO } from "@/lib/mock-dashboard-data";

export interface AppShellProps {
  title: string;
  dataSource?: "database" | "demo";
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/machines", label: "Mesin", icon: Cpu },
  { href: "/actions", label: "Hemat & Aksi", icon: Sparkles },
  { href: "/settings", label: "Pengaturan", icon: Settings2 },
] as const;

export function AppShell({
  title,
  dataSource = "demo",
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-screen bg-[#080b11] text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-[#0b0f18] lg:flex">
        {/* Brand */}
        <div className="flex h-15 items-center gap-2.5 border-b border-border/60 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-600/20">
            <Zap className="size-4 fill-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">
              WattWise
            </p>
            <p className="text-[11px] text-zinc-500">Audit Energi</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
                    : "text-zinc-400 hover:bg-muted/60 hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`size-4 ${
                    active ? "text-orange-400" : "text-zinc-500"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: Workshop & Live Status */}
        <div className="border-t border-border/60 p-4 space-y-2.5">
          <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
            <p className="truncate text-xs font-medium text-zinc-200">
              {WORKSHOP_INFO.name}
            </p>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                ESP32 Online
              </span>
              <span className="font-mono text-zinc-500">
                {WORKSHOP_INFO.esp32OnlineCount}/{WORKSHOP_INFO.esp32TotalCount}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-3 border-b border-border/70 bg-[#0b0f18]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="size-8 lg:hidden"
              aria-label="Menu navigasi"
            >
              {mobileNavOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </Button>

            <h1 className="text-base font-semibold tracking-tight text-white">
              {title}
            </h1>

            <Badge
              variant="outline"
              className={
                dataSource === "database"
                  ? "hidden border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300 sm:inline-flex"
                  : "hidden border-zinc-700 bg-zinc-900 text-[10px] text-zinc-400 sm:inline-flex"
              }
            >
              <Activity className="mr-1 size-3" />
              {dataSource === "database" ? "Live DB" : "Demo"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {actions}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-8 gap-2 rounded-lg px-2 hover:bg-muted/70"
                  />
                }
              >
                <Avatar className="size-6.5 border border-orange-500/40">
                  <AvatarFallback className="bg-orange-600/20 text-[11px] font-semibold text-orange-300">
                    PP
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-xs font-medium text-zinc-200 sm:inline">
                  {WORKSHOP_INFO.ownerName}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {WORKSHOP_INFO.code}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    render={<Link href="/settings" />}
                    className="text-xs"
                  >
                    <Settings2 className="mr-2 size-3.5" />
                    Pengaturan
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
        </header>

        {/* Mobile Drawer Nav */}
        {mobileNavOpen && (
          <nav className="border-b border-border/70 bg-[#0b0f18] p-3 lg:hidden">
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                      active
                        ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
                        : "text-zinc-400 hover:bg-muted/60 hover:text-white"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Page Body */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
