"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("owner");
  const [password, setPassword] = React.useState("wattwise123");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submitCredentials(userVal: string, passVal: string) {
    setError(null);
    setLoading(true);
    try {
      const normalizedUser = userVal.includes("@")
        ? userVal.split("@")[0].toLowerCase()
        : userVal.trim();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUser,
          password: passVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login gagal. Periksa akun Anda.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server WattWise.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitCredentials(username, password);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground">
          Masuk ke WattWise
        </h2>
        <p className="text-[13.5px] text-muted-foreground">
          Gunakan akun kerja Anda untuk melanjutkan ke dasbor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="username"
            className="text-xs font-medium text-foreground"
          >
            Email atau Username
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="owner atau nama@perusahaan.co.id"
              autoComplete="username"
              required
              className="h-10 rounded-lg border-border bg-card pl-9 text-[13.5px]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-medium text-foreground"
          >
            Kata sandi
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
              className="h-10 rounded-lg border-border bg-card pr-10 pl-9 text-[13.5px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Tampilkan atau sembunyikan kata sandi"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              className="border-zinc-300 data-checked:border-[#059669] data-checked:bg-[#059669]"
            />
            <span>Ingat saya</span>
          </label>
          <button
            type="button"
            onClick={() => {
              setUsername("owner");
              setPassword("wattwise123");
            }}
            className="font-medium text-[#047857] hover:underline dark:text-emerald-400"
          >
            Isi akun demo
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-10 w-full rounded-lg bg-[#059669] text-[13.5px] font-medium text-white hover:bg-[#047857]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              Masuk
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#FAFAFA] px-3 text-muted-foreground dark:bg-[#0E0E11]">
              atau
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => submitCredentials("teknisi", "teknisi123")}
          className="h-10 w-full rounded-lg border-border bg-card text-[13.5px] font-medium text-foreground hover:bg-muted"
        >
          <KeyRound className="mr-2 size-4 text-muted-foreground" />
          Masuk sebagai Teknisi Bengkel
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Akun pilot:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
          owner / wattwise123
        </code>{" "}
        atau{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
          teknisi / teknisi123
        </code>
      </p>
    </div>
  );
}
