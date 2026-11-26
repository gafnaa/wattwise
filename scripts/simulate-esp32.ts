/**
 * WattWise ESP32 Telemetry Simulator CLI
 *
 * Penggunaan:
 *   npm run iot:simulate
 *   npm run iot:simulate -- --mode=telemetry --device=ESP32-CNC-1325 --key=ww_dev_cnc_1325_demo
 *   npm run iot:simulate -- --mode=demo-tick --scenario=high_idle
 */

const baseUrl = (process.env.WATTWISE_API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function runDemoTickMode(scenario: string) {
  console.log(`[WattWise Simulator] POST ${baseUrl}/api/simulator/demo-tick (scenario=${scenario})`);
  const res = await fetch(`${baseUrl}/api/simulator/demo-tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, persist: true }),
  });
  const json = await res.json();
  console.log(`HTTP ${res.status}:`, JSON.stringify(json, null, 2));
}

async function runEsp32TelemetryMode(deviceUid: string, apiKey: string) {
  // Siklus realistis: OFF -> START_UP -> IDLE -> WORKING -> IDLE (format 3-kolom hardware)
  const sequenceW = [4, 4, 6100, 5600, 1650, 1660, 4420, 4680, 4310, 1655, 1645];
  console.log(
    `[WattWise ESP32 Sim] Streaming ${sequenceW.length} samples to ${baseUrl}/api/iot/telemetry as ${deviceUid}`
  );

  const nowMs = Date.now();
  const readings = sequenceW.map((daya, i) => ({
    index: i + 1,
    timestamp: new Date(nowMs - (sequenceW.length - i) * 2000).toISOString(),
    daya,
    is_simulated: true,
  }));

  const res = await fetch(`${baseUrl}/api/iot/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-UID": deviceUid,
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      device_uid: deviceUid,
      readings,
    }),
  });

  const json = await res.json();
  console.log(`HTTP ${res.status}:`, JSON.stringify(json, null, 2));
}

async function main() {
  const mode = getArg("mode", "demo-tick");
  if (mode === "telemetry") {
    const deviceUid = getArg("device", "ESP32-CNC-1325");
    const apiKey = getArg("key", "ww_dev_cnc_1325_demo");
    await runEsp32TelemetryMode(deviceUid, apiKey);
  } else {
    const scenario = getArg("scenario", "normal");
    await runDemoTickMode(scenario);
  }
}

main().catch((err) => {
  console.error("[Simulator Error]", err);
  process.exit(1);
});
