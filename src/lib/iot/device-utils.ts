import crypto from "node:crypto";
import { hashDeviceApiKey } from "@/lib/auth";

export const DEFAULT_HEARTBEAT_TIMEOUT_SEC = 30;

export function generateDeviceApiKey(): {
  rawKey: string;
  apiKeyHash: string;
} {
  const randomHex = crypto.randomBytes(20).toString("hex");
  const rawKey = `ww_dev_${randomHex}`;
  return {
    rawKey,
    apiKeyHash: hashDeviceApiKey(rawKey),
  };
}

export function evaluateDeviceOnlineStatus(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
  timeoutSec: number = DEFAULT_HEARTBEAT_TIMEOUT_SEC
): {
  status: "ONLINE" | "OFFLINE";
  secondsSinceLastSeen: number | null;
} {
  if (!lastSeenAt) {
    return { status: "OFFLINE", secondsSinceLastSeen: null };
  }
  const seenMs =
    lastSeenAt instanceof Date ? lastSeenAt.getTime() : Date.parse(lastSeenAt);
  if (Number.isNaN(seenMs)) {
    return { status: "OFFLINE", secondsSinceLastSeen: null };
  }
  const diffSec = Math.max(0, Math.round((now.getTime() - seenMs) / 1000));
  return {
    status: diffSec <= timeoutSec ? "ONLINE" : "OFFLINE",
    secondsSinceLastSeen: diffSec,
  };
}
