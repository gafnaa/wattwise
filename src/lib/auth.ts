import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "wattwise_session";

export type UserRole = "OWNER" | "TECHNICIAN" | "ADMIN";

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  workshopId: string;
  workshopName: string;
}

export type ApiAuthorizationResult =
  | { allowed: true; session: SessionPayload | null }
  | { allowed: false; status: 401 | 403; error: string };

/**
 * Evaluasi murni autentikasi & RBAC endpoint API mutasi.
 * - Jika user sudah login namun rolenya tidak diizinkan -> selalu 403 Forbidden.
 * - Jika belum login dan `enforceAuth=true` -> 401 Unauthorized.
 * - Jika belum login dan `enforceAuth=false` -> diizinkan khusus mode dev/demo lokal.
 */
export function evaluateApiAuthorization(params: {
  session: SessionPayload | null;
  allowedRoles?: readonly UserRole[];
  enforceAuth: boolean;
}): ApiAuthorizationResult {
  const { session, allowedRoles, enforceAuth } = params;

  if (!session) {
    if (enforceAuth) {
      return {
        allowed: false,
        status: 401,
        error: "Autentikasi diperlukan. Silakan login terlebih dahulu.",
      };
    }
    return { allowed: true, session: null };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      allowed: false,
      status: 403,
      error: "Akses ditolak. Peran akun Anda tidak memiliki izin untuk aksi ini.",
    };
  }

  return { allowed: true, session };
}

/**
 * Guard siap pakai untuk API Route Handlers mutasi (`POST`, `PATCH`, `DELETE`).
 */
export async function requireApiAuth(options?: {
  roles?: readonly UserRole[];
}): Promise<{
  session: SessionPayload | null;
  response: NextResponse | null;
}> {
  const session = await getCurrentSession();
  const enforceAuth = process.env.WATTWISE_ENFORCE_AUTH === "true";
  const decision = evaluateApiAuthorization({
    session,
    allowedRoles: options?.roles,
    enforceAuth,
  });

  if (!decision.allowed) {
    return {
      session: null,
      response: NextResponse.json(
        { error: decision.error },
        { status: decision.status }
      ),
    };
  }

  return { session: decision.session, response: null };
}

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ?? "wattwise-dev-fallback-secret-change-in-prod-32ch";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.workshopId !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      fullName: String(payload.fullName ?? payload.username),
      role: (payload.role as SessionPayload["role"]) ?? "OWNER",
      workshopId: payload.workshopId,
      workshopName: String(
        payload.workshopName ?? "Area Produksi Furnitur — Sukoharjo"
      ),
    };
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function hashDeviceApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
