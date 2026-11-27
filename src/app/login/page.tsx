import { Zap } from "lucide-react";
import { DitherBackground } from "@/components/auth/dither-background";
import { LoginForm } from "@/components/auth/login-form";

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

        {/* Balanced Scrim for crisp centered typography while keeping workshop dither vibrant */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#09090B]/20 via-[#09090B]/58 to-[#09090B]/78"
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

        {/* Centered Editorial Copy */}
        <div className="relative z-10 my-auto max-w-lg py-16 lg:py-0">
          <div className="space-y-3.5">
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[42px] sm:leading-[1.12]">
              Pantau dan hemat energi pabrik Anda secara real-time
            </h1>
            <p className="text-sm leading-relaxed text-zinc-100/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)] sm:text-[15.5px]">
              Satu ruang kerja untuk memantau beban listrik mesin, mendeteksi
              pemborosan idle, dan menindaklanjuti rekomendasi audit energi.
            </p>
          </div>
        </div>

        {/* Footer Caption */}
        <p className="relative z-10 text-xs text-zinc-300/85">
          WattWise Smart Energy Audit · Sentra Furnitur &amp; Manufaktur
        </p>
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
