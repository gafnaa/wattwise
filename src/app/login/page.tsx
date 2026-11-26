import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Masuk — WattWise",
  description: "Masuk ke dashboard audit energi WattWise.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#06080d] px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 h-80 w-80 rounded-full bg-orange-600/10 blur-[120px]"
      />

      <Card className="relative grid w-full max-w-4xl grid-cols-1 overflow-hidden border-border/80 bg-[#0d111a] p-0 shadow-2xl shadow-black/70 lg:min-h-[540px] lg:grid-cols-12">
        {/* Visual Panel */}
        <div className="relative hidden overflow-hidden lg:col-span-6 lg:flex">
          <Image
            src="/images/workshop-hero.jpg"
            alt="Bengkel produksi mebel WattWise"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center brightness-[0.8]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06080d] via-[#06080d]/25 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0d111a]/80" />

          <div className="relative z-10 flex h-full w-full flex-col justify-end p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-orange-400 uppercase">
              WattWise
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-snug text-white">
              Pantau daya idle.
              <br />
              Hemat biaya produksi.
            </h2>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  );
}
