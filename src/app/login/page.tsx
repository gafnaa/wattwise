import { Activity, BarChart3, Sparkles, Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

const HERO_FEATURES = [
  {
    icon: Activity,
    title: "Pemantauan mesin langsung",
    description: "Status, beban, dan konsumsi tiap mesin diperbarui setiap 5 detik.",
  },
  {
    icon: Sparkles,
    title: "Insight energi berbasis AI",
    description:
      "Deteksi pemborosan saat idle dan dapatkan saran jadwal operasi.",
  },
  {
    icon: BarChart3,
    title: "Laporan konsumsi otomatis",
    description:
      "Ringkasan harian, mingguan, dan bulanan siap diekspor ke CSV & PDF.",
  },
] as const;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left Brand Showcase — Exact Figma Obsidian #09090B */}
      <section className="relative flex flex-col justify-between bg-[#09090B] px-8 py-10 text-white sm:px-14 sm:py-12">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#059669] text-white">
            <Zap className="size-5 fill-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-white">
              WattWise
            </p>
            <p className="text-xs text-zinc-400">Energy Intelligence</p>
          </div>
        </div>

        {/* Hero Copy & Features */}
        <div className="my-12 max-w-lg space-y-8">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#10B981] uppercase">
              Platform Energi Industri
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[42px] sm:leading-[1.12]">
              Pantau dan hemat energi pabrik Anda secara real-time
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              Satu dasbor untuk konsumsi listrik, status mesin ISO 14955-5, dan
              rekomendasi penghematan dari AI.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {HERO_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-[#10B981]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-medium text-white">
                      {feat.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          WattWise Smart Energy Audit · IoT + Random Forest + Generative AI
        </p>
      </section>

      {/* Right Clean Light Login Panel */}
      <section className="flex items-center justify-center bg-[#FAFAFA] px-6 py-12 dark:bg-[#0E0E11] sm:px-12">
        <div className="w-full max-w-[390px]">
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
