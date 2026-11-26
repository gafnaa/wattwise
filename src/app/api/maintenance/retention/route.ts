import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

const retentionSchema = z
  .object({
    retentionDays: z.number().int().min(7).max(365).optional().default(30),
    dryRun: z.boolean().optional().default(false),
  })
  .optional();

/**
 * Menjalankan kebijakan rolling retention 30 hari pada tabel mentah
 * `telemetry_readings` (menjaga `machine_state_sessions` tetap permanen agar
 * storage Supabase / Neon free tier 500 MB tahan lama untuk 2-3 bengkel).
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const session = await getCurrentSession();
  const authorizedByCron = Boolean(cronSecret && headerSecret === cronSecret);
  const authorizedBySession =
    session?.role === "OWNER" || session?.role === "ADMIN";

  if (!authorizedByCron && !authorizedBySession) {
    return NextResponse.json(
      { error: "Akses ditolak. Membutuhkan sesi Owner/Admin atau X-Cron-Secret." },
      { status: 401 }
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = retentionSchema.safeParse(rawBody);
  const retentionDays = parsed.success ? (parsed.data?.retentionDays ?? 30) : 30;
  const dryRun = parsed.success ? (parsed.data?.dryRun ?? false) : false;

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

  try {
    if (dryRun) {
      const candidateCount = await db.telemetryReading.count({
        where: { recordedAt: { lt: cutoff } },
      });
      return NextResponse.json({
        ok: true,
        dryRun: true,
        retentionDays,
        cutoffDate: cutoff.toISOString(),
        candidateRows: candidateCount,
      });
    }

    const deleted = await db.telemetryReading.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      retentionDays,
      cutoffDate: cutoff.toISOString(),
      deletedTelemetryRows: deleted.count,
      note: "Ringkasan audit pada machine_state_sessions dipertahankan secara permanen.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Database tidak terjangkau untuk pembersihan retention.",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 503 }
    );
  }
}
