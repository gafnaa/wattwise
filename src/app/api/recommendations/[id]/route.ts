import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "DISMISSED"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response: authError } = await requireApiAuth();
  if (authError) return authError;

  const { id } = await context.params;
  const rawBody = await request.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Status tindakan tidak valid." },
      { status: 400 }
    );
  }

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        id,
        status: parsed.data.status,
      });
    }

    const existing = await db.actionRecommendation.findFirst({
      where: { id, workshopId: workshop.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Rekomendasi tidak ditemukan pada workshop ini." },
        { status: 404 }
      );
    }

    const updated = await db.actionRecommendation.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
      },
    });
    return NextResponse.json({
      ok: true,
      persisted: true,
      id: updated.id,
      status: updated.status,
    });
  } catch {
    // Fallback mode demo jika ID berasal dari mock data atau DB belum aktif
    return NextResponse.json({
      ok: true,
      persisted: false,
      id,
      status: parsed.data.status,
    });
  }
}
