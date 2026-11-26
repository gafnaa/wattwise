import type { Metadata } from "next";
import Image from "next/image";
import { Activity, Cpu, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login — WattWise Smart Audit",
  description:
    "Masuk ke dashboard pemantauan status mesin dan audit efisiensi energi WattWise.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#06080d] px-4 py-8 sm:px-6">
      {/* Ambient industrial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-orange-600/12 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-emerald-500/8 blur-[120px]"
      />

      <Card className="relative grid w-full max-w-5xl grid-cols-1 overflow-hidden border-border/80 bg-[#0d111a]/95 p-0 shadow-2xl shadow-black/70 lg:min-h-[580px] lg:grid-cols-12">
        {/* Left Panel: Woodworking Workshop Visual */}
        <div className="relative hidden min-h-[260px] overflow-hidden lg:col-span-6 lg:flex">
          <Image
            src="/images/workshop-hero.jpg"
            alt="Bengkel produksi mebel kayu WattWise"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center brightness-[0.82] contrast-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06080d] via-[#06080d]/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0d111a]/85" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-7">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-orange-500/40 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-orange-300 backdrop-blur-md"
              >
                <Cpu className="mr-1.5 size-3.5 text-orange-400" />
                IoT PZEM-004T • ISO 14955-5
              </Badge>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-bold leading-snug tracking-tight text-white">
                Pantau Daya Idle Mesin.
                <br />
                <span className="text-orange-400">
                  Hemat Biaya Produksi Mebel.
                </span>
              </h2>
              <p className="max-w-sm text-xs leading-relaxed text-zinc-300">
                Terjemahkan data konsumsi daya mesin kayu menjadi estimasi
                kerugian Rupiah dan rekomendasi penghematan otomatis.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px] text-zinc-200 backdrop-blur-sm">
                  <Activity className="size-3.5 text-emerald-400" />
                  <span>7 Node Sensor Aktif</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px] text-zinc-200 backdrop-blur-sm">
                  <ShieldCheck className="size-3.5 text-amber-400" />
                  <span>Sentra Mebel Sukoharjo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="lg:col-span-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  );
}
