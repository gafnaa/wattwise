/*
 * WattWise — Firmware Node Sensor ESP32 + PZEM-004T v3.0
 *
 * Fitur:
 * - Pembacaan PZEM-004T tiap 2 detik (optimal untuk menangkap lonjakan START_UP).
 * - Offline ring-buffer hingga 50 sampel di RAM jika Wi-Fi bengkel terputus,
 *   lalu otomatis mengirim batch ke POST /api/iot/telemetry saat tersambung kembali.
 * - Mendukung mode 3-kolom ringkas (index, timestamp, daya) maupun payload penuh PZEM.
 *
 * Dependensi Library Arduino:
 * - PZEM004Tv30 (oleh mandulaj)
 * - ArduinoJson (v7+)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <ArduinoJson.h>
#include <time.h>

// ============================================================================
// KONFIGURASI PERANGKAT (SESUAIKAN PER NODE MESIN)
// ============================================================================
const char* WIFI_SSID       = "NAMA_WIFI_BENGKEL";
const char* WIFI_PASS       = "PASSWORD_WIFI_BENGKEL";
const char* SERVER_ENDPOINT = "https://your-wattwise-domain.com/api/iot/telemetry";

// Dapatkan dari `prisma/seed.ts` atau `POST /api/iot/devices`
const char* DEVICE_UID      = "ESP32-CNC-1325";
const char* DEVICE_API_KEY  = "ww_dev_cnc_1325_demo";
const char* FIRMWARE_VER    = "1.0.0";

// Ubah ke `true` jika ingin mengirim 3 kolom ringkas saja (index, timestamp, daya)
const bool MINIMAL_3COL_MODE = false;

// Pin UART2 ESP32 -> PZEM-004T (RX2 = GPIO16, TX2 = GPIO17)
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

// Interval sampling (ms) & ukuran offline buffer
const unsigned long SAMPLE_INTERVAL_MS = 2000;
const int RING_BUFFER_SIZE = 50;

struct TelemetrySample {
  uint32_t sampleIndex;
  unsigned long epochSec;
  float powerW;
  float voltageV;
  float currentA;
  float energyKwh;
  float frequencyHz;
  float powerFactor;
};

TelemetrySample ringBuffer[RING_BUFFER_SIZE];
int bufferHead = 0;
int bufferCount = 0;
uint32_t globalSampleIndex = 0;
unsigned long lastSampleMs = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("\n[WiFi] Offline — buffering telemetry in RAM.");
  }
}

void pushToRingBuffer(const TelemetrySample& sample) {
  int idx = (bufferHead + bufferCount) % RING_BUFFER_SIZE;
  ringBuffer[idx] = sample;
  if (bufferCount < RING_BUFFER_SIZE) {
    bufferCount++;
  } else {
    // Buffer penuh: geser head (buang data paling lama)
    bufferHead = (bufferHead + 1) % RING_BUFFER_SIZE;
  }
}

String formatIsoTimestamp(unsigned long epochSec) {
  if (epochSec < 1700000000UL) {
    return "";
  }
  time_t rawTime = (time_t)epochSec;
  struct tm* timeinfo = gmtime(&rawTime);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buf);
}

bool flushRingBuffer() {
  if (bufferCount == 0 || WiFi.status() != WL_CONNECTED) return false;

  JsonDocument doc;
  doc["device_uid"] = DEVICE_UID;
  JsonArray readings = doc["readings"].to<JsonArray>();

  for (int i = 0; i < bufferCount; i++) {
    int idx = (bufferHead + i) % RING_BUFFER_SIZE;
    const TelemetrySample& s = ringBuffer[idx];

    JsonObject item = readings.add<JsonObject>();
    item["index"] = s.sampleIndex;
    item["firmware_version"] = FIRMWARE_VER;

    String iso = formatIsoTimestamp(s.epochSec);
    if (iso.length() > 0) {
      item["timestamp"] = iso;
    }

    if (MINIMAL_3COL_MODE) {
      item["daya"] = round(s.powerW * 10.0) / 10.0;
    } else {
      JsonObject metrics = item["metrics"].to<JsonObject>();
      metrics["voltage_v"] = round(s.voltageV * 10.0) / 10.0;
      metrics["current_a"] = round(s.currentA * 100.0) / 100.0;
      metrics["power_w"] = round(s.powerW * 10.0) / 10.0;
      metrics["energy_kwh"] = round(s.energyKwh * 1000.0) / 1000.0;
      metrics["frequency_hz"] = round(s.frequencyHz * 10.0) / 10.0;
      metrics["power_factor"] = round(s.powerFactor * 100.0) / 100.0;
    }
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(SERVER_ENDPOINT);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-UID", DEVICE_UID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode >= 200 && httpCode < 300) {
    Serial.printf("[HTTP] Flushed %d reading(s) -> HTTP %d\n", bufferCount, httpCode);
    bufferHead = 0;
    bufferCount = 0;
    return true;
  }

  Serial.printf("[HTTP] Send failed (HTTP %d), keeping %d sample(s) in buffer.\n", httpCode, bufferCount);
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== WattWise ESP32 + PZEM-004T Node ===");
  connectWiFi();
}

void loop() {
  unsigned long nowMs = millis();
  if (nowMs - lastSampleMs < SAMPLE_INTERVAL_MS) {
    return;
  }
  lastSampleMs = nowMs;

  float power = pzem.power();
  float voltage = pzem.voltage();
  float current = pzem.current();
  float energy = pzem.energy();
  float freq = pzem.frequency();
  float pf = pzem.pf();

  if (isnan(power)) {
    Serial.println("[PZEM] Error reading sensor (check RX/TX & AC line)");
    return;
  }

  time_t nowEpoch;
  time(&nowEpoch);

  TelemetrySample sample;
  sample.sampleIndex = ++globalSampleIndex;
  sample.epochSec = (unsigned long)nowEpoch;
  sample.powerW = power;
  sample.voltageV = isnan(voltage) ? 0.0f : voltage;
  sample.currentA = isnan(current) ? 0.0f : current;
  sample.energyKwh = isnan(energy) ? 0.0f : energy;
  sample.frequencyHz = isnan(freq) ? 50.0f : freq;
  sample.powerFactor = isnan(pf) ? 0.0f : pf;

  Serial.printf("[#%lu] P=%.1fW | V=%.1fV | I=%.2fA | PF=%.2f\n",
                sample.sampleIndex, sample.powerW, sample.voltageV, sample.currentA, sample.powerFactor);

  pushToRingBuffer(sample);

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  flushRingBuffer();
}
