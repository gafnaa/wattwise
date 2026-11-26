import assert from "node:assert/strict";
import test from "node:test";
import { hashDeviceApiKey, timingSafeEqualHex } from "../auth";
import {
  evaluateDeviceOnlineStatus,
  generateDeviceApiKey,
} from "../iot/device-utils";

test("generateDeviceApiKey creates prefixed key whose SHA-256 matches hashDeviceApiKey", () => {
  const { rawKey, apiKeyHash } = generateDeviceApiKey();
  assert.match(rawKey, /^ww_dev_[a-f0-9]{40}$/);
  assert.equal(apiKeyHash.length, 64);
  assert.equal(timingSafeEqualHex(apiKeyHash, hashDeviceApiKey(rawKey)), true);
});

test("evaluateDeviceOnlineStatus marks devices ONLINE within 30s and OFFLINE past threshold", () => {
  const now = new Date("2026-11-27T00:00:00Z");

  const fresh = evaluateDeviceOnlineStatus(
    new Date("2026-11-26T23:59:42Z"),
    now,
    30
  );
  assert.equal(fresh.status, "ONLINE");
  assert.equal(fresh.secondsSinceLastSeen, 18);

  const stale = evaluateDeviceOnlineStatus(
    new Date("2026-11-26T23:59:10Z"),
    now,
    30
  );
  assert.equal(stale.status, "OFFLINE");
  assert.equal(stale.secondsSinceLastSeen, 50);

  const neverSeen = evaluateDeviceOnlineStatus(null, now, 30);
  assert.equal(neverSeen.status, "OFFLINE");
  assert.equal(neverSeen.secondsSinceLastSeen, null);
});
