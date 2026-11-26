export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Next.js + Tailwind CSS Boilerplate Ready
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          WattWise
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Sistem Audit Energi Pintar Berbasis IoT untuk Pemantauan Status Mesin
          (ISO 14955-5) dan Efisiensi Daya pada UMKM Mebel Skala Menengah.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-medium text-zinc-500">Edge IoT</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">
              ESP32 + PZEM-004T
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-medium text-zinc-500">AI / ML Engine</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">
              Random Forest (ISO 14955-5)
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-medium text-zinc-500">Reporting</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">
              Dashboard &amp; Telegram Bot
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
