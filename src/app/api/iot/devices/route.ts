import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDeviceApiKey } from "@/lib/iot/device-utils";

const registerDeviceSchema = z.object({
  deviceUid: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "deviceUid hanya boleh huruf, angka, -, _"),
  machineId: z.string().uuid().nullable().optional(),
  isMainMeter: z.boolean().optional().default(false),
  firmwareVersion: z.string().trim().max(32).optional().default("1.0.0"),
});

/**
 * Mendaftarkan node ESP32 baru dan mengembalikan plaintext API key SEKALI saja
 * untuk di-flash ke firmware (di database hanya disimpan hash SHA-256).
 */
export async function POST(request: Request) {
  const { session, response: authError } = await requireApiAuth({
    roles: ["OWNER", "ADMIN"],
  });
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const parsed = registerDeviceSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Payload registrasi device tidak valid.",
      },
      { status: 400 }
    );
  }

  const { rawKey, apiKeyHash } = generateDeviceApiKey();

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json(
        { error: "Workshop belum tersedia di database. Jalankan db:seed dulu." },
        { status: 404 }
      );
    }

    const existing = await db.device.findUnique({
      where: { deviceUid: parsed.data.deviceUid },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Device UID '${parsed.data.deviceUid}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const created = await db.device.create({
      data: {
        workshopId: workshop.id,
        machineId: parsed.data.isMainMeter ? null : (parsed.data.machineId ?? null),
        deviceUid: parsed.data.deviceUid,
        apiKeyHash,
        isMainMeter: parsed.data.isMainMeter,
        firmwareVersion: parsed.data.firmwareVersion,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        device: {
          id: created.id,
          deviceUid: created.deviceUid,
          machineId: created.machineId,
          isMainMeter: created.isMainMeter,
          firmwareVersion: created.firmwareVersion,
        },
        // Hanya dikembalikan sekali pada saat provisioning!
        apiKey: rawKey,
        warning:
          "Simpan apiKey ini sekarang untuk header X-API-Key ESP32; nilai asli tidak disimpan di database.",
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Gagal mendaftarkan perangkat ESP32.",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { session, response: authError } = await requireApiAuth({
    roles: ["OWNER", "ADMIN"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const deviceUid = searchParams.get("deviceUid")?.trim();

  if (!deviceUid) {
    return NextResponse.json(
      { error: "Parameter query deviceUid wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const workshop = session?.workshopId
      ? await db.workshop.findUnique({ where: { id: session.workshopId } })
      : await db.workshop.findFirst({ orderBy: { createdAt: "asc" } });

    if (!workshop) {
      return NextResponse.json(
        { error: "Workshop tidak ditemukan." },
        { status: 404 }
      );
    }

    const deleted = await db.device.deleteMany({
      where: { deviceUid, workshopId: workshop.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: `Device '${deviceUid}' tidak ditemukan pada workshop ini.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, deletedDeviceUid: deviceUid });
  } catch {
    return NextResponse.json(
      { error: `Device '${deviceUid}' tidak ditemukan.` },
      { status: 404 }
    );
  }
}
