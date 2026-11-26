import assert from "node:assert/strict";
import test from "node:test";
import {
  hashDeviceApiKey,
  signSessionToken,
  timingSafeEqualHex,
  verifySessionToken,
} from "../auth";
import { sendTelegramMessage } from "../telegram/bot";

test("JWT session token signs and verifies Workshop Owner payload cleanly", async () => {
  const token = await signSessionToken({
    userId: "u-owner-1",
    username: "owner",
    fullName: "Pemilik Pabrik",
    role: "OWNER",
    workshopId: "ws-skh-01",
    workshopName: "Area Produksi Furnitur",
  });

  assert.ok(token.split(".").length === 3);

  const verified = await verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.username, "owner");
  assert.equal(verified.role, "OWNER");
  assert.equal(verified.workshopId, "ws-skh-01");

  const invalid = await verifySessionToken("invalid.jwt.token");
  assert.equal(invalid, null);
});

test("Device API key SHA-256 hash and timing-safe check work for ESP32 auth", () => {
  const hash1 = hashDeviceApiKey("ww_dev_cnc_1325_demo");
  const hash2 = hashDeviceApiKey("ww_dev_cnc_1325_demo");
  const hashWrong = hashDeviceApiKey("ww_dev_wrong_key");

  assert.equal(hash1.length, 64);
  assert.equal(timingSafeEqualHex(hash1, hash2), true);
  assert.equal(timingSafeEqualHex(hash1, hashWrong), false);
});

test("Telegram client falls back safely to simulated mode when token is unset", async () => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;

  try {
    const res = await sendTelegramMessage({
      chatId: "123456789",
      text: "Test laporan WattWise",
    });
    assert.equal(res.ok, true);
    assert.equal(res.mode, "simulated");
  } finally {
    if (prevToken !== undefined) {
      process.env.TELEGRAM_BOT_TOKEN = prevToken;
    }
  }
});
