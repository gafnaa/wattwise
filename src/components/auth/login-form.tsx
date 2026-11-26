"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Radio,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("owner");
  const [password, setPassword] = React.useState("wattwise123");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    // Simulasi autentikasi UI sebelum terhubung ke API /api/auth/login
    window.setTimeout(() => {
      const validDemo =
        (username.trim().toLowerCase() === "owner" &&
          password === "wattwise123") ||
        (username.trim().toLowerCase() === "teknisi" &&
          password === "teknisi123");

      if (!validDemo) {
        setError(
          "Kredensial tidak cocok. Gunakan akun demo: owner / wattwise123"
        );
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
    }, 350);
  }

  return (
    <div className="flex h-full flex-col justify-between p-7 sm:p-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        {/* Emblem WattWise */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-full border border-orange-500/30 bg-gradient-to-b from-zinc-100 to-zinc-300 shadow-[0_0_30px_rgba(234,88,12,0.28)]">
            <div className="flex size-11 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-950 text-orange-500">
              <Zap className="size-5 fill-orange-500" />
            </div>
          </div>
          <span className="text-[11px] font-semibold tracking-[0.26em] text-orange-400 uppercase">
            WattWise
          </span>
          <h1 className="mt-1.5 text-xl font-bold tracking-[0.14em] text-white uppercase">
            User Login
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Smart Audit — Sistem Manajemen Energi UMKM Mebel
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-medium text-zinc-300"
            >
              Username
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-orange-400/90" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 rounded-full border-orange-500/35 bg-orange-950/25 pl-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-orange-500 focus-visible:ring-orange-500/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-zinc-300"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-orange-400/90" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-full border-orange-500/35 bg-orange-950/25 pr-10 pl-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-orange-500 focus-visible:ring-orange-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-200"
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember & Forgot Password */}
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-zinc-400 select-none hover:text-zinc-200">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                className="border-zinc-600 data-checked:border-orange-500 data-checked:bg-orange-600"
              />
              <span>Remember me</span>
            </label>

            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="text-zinc-400 transition-colors hover:text-orange-400"
                  />
                }
              >
                Forgot password?
              </DialogTrigger>
              <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-orange-400" />
                    Bantuan Akses Akun Bengkel
                  </DialogTitle>
                  <DialogDescription>
                    Untuk reset kata sandi akun bengkel mitra, hubungi Admin
                    Teknis WattWise atau gunakan akun demo berikut untuk
                    pengujian:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 rounded-lg border border-border bg-background/70 p-3 font-mono text-xs text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Owner:</span>
                    <span>owner / wattwise123</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Teknisi:</span>
                    <span>teknisi / teknisi123</span>
                  </div>
                </div>
                <DialogFooter showCloseButton />
              </DialogContent>
            </Dialog>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Primary Login CTA */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-10 w-full rounded-full bg-gradient-to-r from-orange-600 to-amber-600 text-xs font-semibold tracking-[0.18em] text-white uppercase shadow-lg shadow-orange-600/25 transition-all hover:from-orange-500 hover:to-amber-500"
          >
            {isSubmitting ? "Memverifikasi..." : "Login"}
          </Button>
        </form>

        {/* Demo Quick Access Note */}
        <div className="mt-5 rounded-xl border border-border/80 bg-background/50 px-3.5 py-2.5 text-center text-[11px] text-muted-foreground">
          Akun demo siap pakai:{" "}
          <span className="font-mono text-zinc-200">owner</span> /{" "}
          <span className="font-mono text-zinc-200">wattwise123</span>
        </div>
      </div>

      {/* Live Hardware Status Indicator (sesuai Lampiran 5 Gambar 5.1) */}
      <div className="mt-6 flex items-center justify-end gap-2 text-[11px] text-zinc-400">
        <Radio className="size-3.5 text-emerald-400" />
        <span>Sistem Terhubung</span>
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium text-emerald-400">ESP32 Online</span>
      </div>
    </div>
  );
}
