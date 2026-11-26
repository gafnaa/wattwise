import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  type SessionPayload,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { WORKSHOP_INFO } from "@/lib/mock-dashboard-data";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  rememberMe: z.boolean().optional().default(true),
});

const DEMO_USERS: Record<
  string,
  {
    password: string;
    payload: SessionPayload;
  }
> = {
  owner: {
    password: "wattwise123",
    payload: {
      userId: "demo-owner",
      username: "owner",
      fullName: WORKSHOP_INFO.ownerName,
      role: "OWNER",
      workshopId: "demo-ws-skh-01",
      workshopName: WORKSHOP_INFO.name,
    },
  },
  teknisi: {
    password: "teknisi123",
    payload: {
      userId: "demo-teknisi",
      username: "teknisi",
      fullName: "Teknisi Bengkel",
      role: "TECHNICIAN",
      workshopId: "demo-ws-skh-01",
      workshopName: WORKSHOP_INFO.name,
    },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Format input login tidak valid",
        },
        { status: 400 }
      );
    }

    const username = parsed.data.username.toLowerCase();
    const { password, rememberMe } = parsed.data;

    let sessionPayload: SessionPayload | null = null;
    let authSource: "database" | "demo" = "database";

    try {
      const user = await db.user.findUnique({
        where: { username },
        include: { workshop: true },
      });

      if (user) {
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return NextResponse.json(
            { error: "Username atau password salah." },
            { status: 401 }
          );
        }
        sessionPayload = {
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          workshopId: user.workshopId,
          workshopName: user.workshop.name,
        };
      }
    } catch {
      // Database belum tersedia — fallback ke akun demo jika mode demo aktif
      authSource = "demo";
    }

    if (!sessionPayload) {
      const demoAllowed = process.env.WATTWISE_DEMO_MODE !== "false";
      const demoEntry = demoAllowed ? DEMO_USERS[username] : undefined;

      if (demoEntry && demoEntry.password === password) {
        sessionPayload = demoEntry.payload;
        authSource = "demo";
      } else {
        return NextResponse.json(
          {
            error:
              "Kredensial tidak cocok. Gunakan akun demo: owner / wattwise123",
          },
          { status: 401 }
        );
      }
    }

    const token = await signSessionToken(sessionPayload);
    const response = NextResponse.json({
      ok: true,
      authSource,
      user: sessionPayload,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: rememberMe ? 60 * 60 * 24 * 7 : undefined,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses login." },
      { status: 500 }
    );
  }
}
