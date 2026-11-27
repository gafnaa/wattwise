import assert from "node:assert/strict";
import test from "node:test";
import {
  hashDeviceApiKey,
  signSessionToken,
  timingSafeEqualHex,
  verifySessionToken,
} from "../auth";
import { telemetryBodySchema } from "../iot/telemetry-schema";
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

test("Telemetry schema parses batch readings and single payloads without stripping batch arrays", () => {
  const batchParsed = telemetryBodySchema.safeParse({
    device_uid: "ESP32-CNC-1325",
    readings: [
      { index: 1, timestamp: "2026-11-27T00:00:00.000Z", daya: 4 },
      { index: 2, timestamp: "2026-11-27T00:00:02.000Z", daya: 4450 },
    ],
  });
  assert.equal(batchParsed.success, true);
  assert.ok("readings" in batchParsed.data);
  assert.equal(batchParsed.data.readings.length, 2);
  assert.equal(batchParsed.data.readings[1]?.daya, 4450);

  const singlePzem = telemetryBodySchema.safeParse({
    device_uid: "ESP32-CNC-1325",
    metrics: { voltage_v: 221.4, current_a: 19.2, power_w: 4250, power_factor: 0.91 },
  });
  assert.equal(singlePzem.success, true);
  assert.ok(!("readings" in singlePzem.data));
  assert.equal(singlePzem.data.metrics?.power_w, 4250);

  const invalidEmpty = telemetryBodySchema.safeParse({
    device_uid: "ESP32-CNC-1325",
  });
  assert.equal(invalidEmpty.success, false);
});
