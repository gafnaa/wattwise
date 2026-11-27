import { Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

const PIPELINE_STAGES = [
  {
    step: "Sensor IoT",
    metric: "5 detik",
    detail:
      "Telemetri daya mesin prioritas (ESP32 + PZEM-004T) dan agregasi Virtual CT.",
  },
  {
    step: "Random Forest",
    metric: "ISO 14955-5",
    detail:
      "Klasifikasi otomatis status Working, Idle, Start-up, dan Off secara real-time.",
  },
  {
    step: "AI Advisor",
    metric: "Telegram & Web",
    detail:
      "Rekomendasi penghematan berbasis jam rawan idle dan tanya-jawab data bengkel.",
  },
] as const;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left Brand Column — Obsidian #09090B */}
      <section className="flex flex-col justify-between bg-[#09090B] px-6 py-8 text-white sm:px-12 sm:py-12 lg:px-14">
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

        <div className="my-10 max-w-lg space-y-8 lg:my-12">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-[42px] sm:leading-[1.12]">
              Pantau dan hemat energi pabrik Anda secara real-time
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              Satu ruang kerja untuk memantau beban listrik mesin, mendeteksi
              pemborosan idle, dan menindaklanjuti rekomendasi audit energi.
            </p>
          </div>

          {/* Crisp Hairline-Divided 3-Stage Architecture Spec */}
          <dl className="divide-y divide-zinc-800/90 border-y border-zinc-800/90">
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage.step}
                className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[120px_1fr] sm:gap-4"
              >
                <dt>
                  <span className="block text-[13px] font-medium text-white">
                    {stage.step}
                  </span>
                  <span className="font-mono text-xs text-[#10B981]">
                    {stage.metric}
                  </span>
                </dt>
                <dd className="text-xs leading-relaxed text-zinc-400">
                  {stage.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-zinc-500">
          WattWise Smart Energy Audit · Sentra Furnitur &amp; Manufaktur
        </p>
      </section>

      {/* Right Clean Light Login Surface */}
      <section className="flex items-center justify-center bg-background px-6 py-10 sm:px-12 sm:py-12">
        <div className="w-full max-w-[390px]">
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
