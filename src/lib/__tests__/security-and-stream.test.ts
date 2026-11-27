import assert from "node:assert/strict";
import test from "node:test";
import { evaluateApiAuthorization, type SessionPayload } from "../auth";
import { INITIAL_MACHINES } from "../mock-dashboard-data";
import { mergeStreamSnapshotIntoMachines } from "../stream/merge-snapshot";
import {
  formatUnauthorizedTelegramMessage,
  resolveAuthorizedTelegramWorkshop,
} from "../telegram/auth";

test("mergeStreamSnapshotIntoMachines updates live power/status while preserving static metadata", () => {
  const merged = mergeStreamSnapshotIntoMachines(INITIAL_MACHINES, [
    {
      id: INITIAL_MACHINES[0].id,
      code: INITIAL_MACHINES[0].code,
      status: "IDLE",
      currentPowerW: 1520,
      currentA: 7.4,
      powerFactor: 0.72,
      sessionDurationSec: 1840,
    },
  ]);

  assert.equal(merged.length, INITIAL_MACHINES.length);
  assert.equal(merged[0].status, "IDLE");
  assert.equal(merged[0].currentPowerW, 1520);
  assert.equal(merged[0].sessionDurationSec, 1840);
  // Metadata penting tidak boleh hilang tertimpa payload parsial
  assert.equal(merged[0].ratedPowerW, INITIAL_MACHINES[0].ratedPowerW);
  assert.equal(merged[0].categoryLabel, INITIAL_MACHINES[0].categoryLabel);
  assert.equal(
    merged[0].idleAlertThresholdMin,
    INITIAL_MACHINES[0].idleAlertThresholdMin
  );
  assert.equal(
    merged[0].workingHoursMonth,
    INITIAL_MACHINES[0].workingHoursMonth
  );
  // Mesin lain yang tidak masuk snapshot tetap utuh
  assert.deepEqual(merged[1], INITIAL_MACHINES[1]);
});

test("evaluateApiAuthorization enforces 401/403 correctly for RBAC and enforceAuth", () => {
  const ownerSession: SessionPayload = {
    userId: "u-1",
    username: "owner",
    fullName: "Pemilik",
    role: "OWNER",
    workshopId: "ws-1",
    workshopName: "Bengkel A",
  };
  const techSession: SessionPayload = {
    userId: "u-2",
    username: "teknisi",
    fullName: "Teknisi",
    role: "TECHNICIAN",
    workshopId: "ws-1",
    workshopName: "Bengkel A",
  };

  // Unauthenticated when enforceAuth=true -> 401
  const unauthStrict = evaluateApiAuthorization({
    session: null,
    allowedRoles: ["OWNER", "ADMIN"],
    enforceAuth: true,
  });
  assert.equal(unauthStrict.allowed, false);
  if (!unauthStrict.allowed) assert.equal(unauthStrict.status, 401);

  // Unauthenticated when enforceAuth=false -> allowed in local dev/demo
  const unauthDemo = evaluateApiAuthorization({
    session: null,
    allowedRoles: ["OWNER", "ADMIN"],
    enforceAuth: false,
  });
  assert.equal(unauthDemo.allowed, true);

  // Logged-in TECHNICIAN attempting OWNER-only route -> always 403
  const techForbidden = evaluateApiAuthorization({
    session: techSession,
    allowedRoles: ["OWNER", "ADMIN"],
    enforceAuth: false,
  });
  assert.equal(techForbidden.allowed, false);
  if (!techForbidden.allowed) assert.equal(techForbidden.status, 403);

  // Logged-in OWNER on OWNER-only route -> allowed
  const ownerAllowed = evaluateApiAuthorization({
    session: ownerSession,
    allowedRoles: ["OWNER", "ADMIN"],
    enforceAuth: true,
  });
  assert.equal(ownerAllowed.allowed, true);
});

test("resolveAuthorizedTelegramWorkshop isolates workshops and rejects unknown external chat IDs", () => {
  const workshops = [
    { id: "ws-1", name: "Bengkel Solo", telegramChatId: "8029588270" },
    { id: "ws-2", name: "Bengkel Jepara", telegramChatId: "9911223344" },
  ];

  const match2 = resolveAuthorizedTelegramWorkshop({
    incomingChatId: "9911223344",
    workshops,
    defaultChatId: "8029588270",
  });
  assert.deepEqual(match2, {
    authorized: true,
    workshopId: "ws-2",
    matchedBy: "workshop",
  });

  const envFallback = resolveAuthorizedTelegramWorkshop({
    incomingChatId: "7777777",
    workshops,
    defaultChatId: "7777777",
  });
  assert.deepEqual(envFallback, {
    authorized: true,
    workshopId: "ws-1",
    matchedBy: "env_default",
  });

  const intruder = resolveAuthorizedTelegramWorkshop({
    incomingChatId: "123456789",
    workshops,
    defaultChatId: "8029588270",
  });
  assert.deepEqual(intruder, {
    authorized: false,
    workshopId: null,
    matchedBy: null,
  });

  const msg = formatUnauthorizedTelegramMessage("123456789");
  assert.ok(msg.includes("123456789"));
});
