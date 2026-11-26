"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, Zap } from "lucide-react";
import { TextMorph } from "torph/react";
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
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hardwareOnline, setHardwareOnline] = React.useState({
    connected: true,
    esp32Online: 7,
    esp32Total: 7,
  });

  React.useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.hardwareStatus) {
          setHardwareOnline(data.hardwareStatus);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Isi username dan password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          rememberMe,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Username atau password salah.");
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Koneksi gagal. Coba lagi.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-between p-7 sm:p-10">
      <div className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-600/25">
            <Zap className="size-6 fill-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Masuk</h1>
          <p className="mt-1 text-xs text-zinc-500">Akun demo: owner / wattwise123</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs text-zinc-400">
              Username
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 bg-background/70 pl-9 text-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-zinc-400">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-background/70 pr-9 pl-9 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                aria-label="Toggle password"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 select-none">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              className="border-zinc-700 data-checked:border-orange-500 data-checked:bg-orange-600"
            />
            <span>Ingat saya</span>
          </label>

          {error && (
            <p className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-10 w-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-500"
          >
            <TextMorph>{isSubmitting ? "Memproses..." : "Masuk"}</TextMorph>
          </Button>
        </form>
      </div>

      {/* Compact live status */}
      <div className="mt-6 flex items-center justify-end gap-2 text-[11px] text-zinc-500">
        <span className="relative flex size-2">
          {hardwareOnline.connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex size-2 rounded-full ${
              hardwareOnline.connected ? "bg-emerald-500" : "bg-zinc-600"
            }`}
          />
        </span>
        <TextMorph>
          {hardwareOnline.connected
            ? `ESP32 Online (${hardwareOnline.esp32Online}/${hardwareOnline.esp32Total})`
            : "ESP32 Offline"}
        </TextMorph>
      </div>
    </div>
  );
}
