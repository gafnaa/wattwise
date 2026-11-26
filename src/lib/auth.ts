import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "wattwise_session";

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  role: "OWNER" | "TECHNICIAN" | "ADMIN";
  workshopId: string;
  workshopName: string;
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
