import { Zap } from "lucide-react";
import { DitherBackground } from "@/components/auth/dither-background";
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
      {/* Left Brand Column — Sunlit Painterly Workshop with Crisp Bayer 4x4 Dither */}
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-border bg-[#141714] px-6 py-8 text-white sm:px-12 sm:py-12 lg:border-r lg:border-b-0 lg:px-14">
        {/* Full-Visibility Lumno-Style Bayer 4x4 Ordered-Dither Canvas */}
        <DitherBackground
          src="/images/login-workshop-illustration.jpg"
          cellSize={3}
          brightness={0.01}
          contrast={1.06}
          grain={0.85}
          levels={7}
          className="opacity-100"
        />

        {/* Targeted Bottom Scrim ONLY behind text — keeps sunlit windows, greenery & CNC vibrant */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090B]/92 via-[#09090B]/48 via-45% to-transparent"
        />

        {/* Brand Pill */}
        <div className="relative z-10 flex items-center">
          <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-[#09090B]/65 px-3.5 py-2 backdrop-blur-md">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#059669] text-white shadow-xs">
              <Zap className="size-4.5 fill-white" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight text-white">
                WattWise
              </p>
              <p className="text-xs text-zinc-200/85">Energy Intelligence</p>
            </div>
          </div>
        </div>

        {/* Lower Copy & Architecture Spec */}
        <div className="relative z-10 mt-28 max-w-lg space-y-6 lg:mt-auto lg:pt-24">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-[40px] sm:leading-[1.12]">
              Pantau dan hemat energi pabrik Anda secara real-time
            </h1>
            <p className="text-sm leading-relaxed text-zinc-100/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-[15px]">
              Satu ruang kerja untuk memantau beban listrik mesin, mendeteksi
              pemborosan idle, dan menindaklanjuti rekomendasi audit energi.
            </p>
          </div>

          <dl className="divide-y divide-white/15 rounded-xl border border-white/15 bg-[#09090B]/72 px-4 backdrop-blur-md">
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage.step}
                className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[120px_1fr] sm:gap-4"
              >
                <dt>
                  <span className="block text-[13px] font-medium text-white">
                    {stage.step}
                  </span>
                  <span className="font-mono text-xs text-[#34D399]">
                    {stage.metric}
                  </span>
                </dt>
                <dd className="text-xs leading-relaxed text-zinc-200/90">
                  {stage.detail}
                </dd>
              </div>
            ))}
          </dl>

          <p className="pt-1 text-xs text-zinc-300/85">
            WattWise Smart Energy Audit · Sentra Furnitur &amp; Manufaktur
          </p>
        </div>
      </section>

      {/* Right Login Surface */}
      <section className="flex items-center justify-center bg-background px-6 py-10 sm:px-12 sm:py-12">
        <div className="w-full max-w-[390px]">
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
