/*
 * WattWise — Firmware Node Sensor ESP32 + PZEM-004T v3.0 (v1.1.0)
 *
 * Fitur Produksi:
 * - Pembacaan PZEM-004T tiap 2 detik (resolusi optimal untuk lonjakan START_UP Random Forest).
 * - Batch HTTP POST tiap 10 detik (5 sampel sekaligus -> 5x lebih hemat trafik & stabil di Railway).
 * - Dukungan HTTPS TLS penuh via WiFiClientSecure + Root CA ISRG Root X1 (Railway / Let's Encrypt),
 *   sekaligus auto-detect HTTP biasa untuk pengujian LAN lokal.
 * - Sinkronisasi NTP saat boot + backfill timestamp akurat untuk sampel offline.
 * - Offline ring-buffer hingga 50 sampel di RAM + chunked flush (25 sampel/request) +
 *   non-blocking Wi-Fi reconnect agar sampling tidak terhenti saat Wi-Fi bengkel putus.
 *
 * Dependensi Library Arduino / PlatformIO:
 * - PZEM004Tv30 (oleh mandulaj)
 * - ArduinoJson (v7+)
 */

#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <ArduinoJson.h>
#include <time.h>
#include <string.h>

// ============================================================================
// KONFIGURASI PERANGKAT (SESUAIKAN PER NODE MESIN)
// ============================================================================
const char* WIFI_SSID       = "NAMA_WIFI_BENGKEL";
const char* WIFI_PASS       = "PASSWORD_WIFI_BENGKEL";

// Arahkan ke domain publik Railway (HTTPS) atau IP LAN lokal (HTTP)
const char* SERVER_ENDPOINT = "https://your-wattwise-app.up.railway.app/api/iot/telemetry";

// Buat node baru di halaman `/devices` untuk mendapatkan API key produksi yang unik
const char* DEVICE_UID      = "ESP32-CNC-1325";
const char* DEVICE_API_KEY  = "GANTI_DENGAN_API_KEY_PRODUKSI";
const char* FIRMWARE_VER    = "1.1.0";

// Ubah ke `true` jika hanya ingin mengirim 3 kolom ringkas (index, timestamp, daya)
const bool MINIMAL_3COL_MODE = false;

// Set `false` (disarankan) untuk verifikasi sertifikat TLS memakai ISRG Root X1.
// Ubah ke `true` hanya untuk uji coba jika domain Anda memakai CA selain Let's Encrypt/ISRG.
const bool ALLOW_INSECURE_TLS = false;

// Pin UART2 ESP32 -> PZEM-004T (RX2 = GPIO16, TX2 = GPIO17)
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

// ============================================================================
// TIMING & BUFFER PRODUKSI
// ============================================================================
const unsigned long SAMPLE_INTERVAL_MS         = 2000;   // Baca PZEM tiap 2 detik
const unsigned long FLUSH_INTERVAL_MS          = 10000;  // Kirim batch tiap 10 detik (5 sampel)
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 15000;  // Coba sambung ulang Wi-Fi tiap 15 detik
const unsigned long HTTP_TIMEOUT_MS            = 8000;   // Timeout HTTP/TLS 8 detik
const unsigned long NTP_BOOT_TIMEOUT_MS        = 8000;   // Tunggu sinkronisasi NTP saat boot
const unsigned long VALID_EPOCH_MIN            = 1700000000UL;

const int RING_BUFFER_SIZE      = 50; // ~100 detik data offline di RAM
const int MAX_BATCH_PER_REQUEST = 25; // Pecah batch besar agar hemat heap ESP32

// Let's Encrypt / Railway Root CA — ISRG Root X1 (berlaku hingga Juni 2035)
const char* ROOT_CA_ISRG_X1 = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

struct TelemetrySample {
  uint32_t sampleIndex;
  unsigned long epochSec;
  unsigned long capturedMs;
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
unsigned long lastFlushMs = 0;
unsigned long lastWifiAttemptMs = 0;
bool ntpSynced = false;

bool isHttpsEndpoint(const char* url) {
  return strncmp(url, "https://", 8) == 0;
}

bool syncNtpTime(unsigned long maxWaitMs) {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");
  unsigned long startMs = millis();
  time_t nowEpoch = 0;

  Serial.print("[NTP] Sinkronisasi waktu UTC/WIB");
  while (millis() - startMs < maxWaitMs) {
    time(&nowEpoch);
    if ((unsigned long)nowEpoch >= VALID_EPOCH_MIN) {
      ntpSynced = true;
      Serial.printf("\n[NTP] Sinkron! Epoch=%lu\n", (unsigned long)nowEpoch);
      return true;
    }
    delay(250);
    Serial.print(".");
  }

  Serial.println("\n[NTP] Belum sinkron (akan backfill otomatis setelah tersambung).");
  return false;
}

void backfillMissingTimestamps() {
  time_t nowEpoch = 0;
  time(&nowEpoch);
  if ((unsigned long)nowEpoch < VALID_EPOCH_MIN) return;

  ntpSynced = true;
  unsigned long nowMs = millis();
  for (int i = 0; i < bufferCount; i++) {
    int idx = (bufferHead + i) % RING_BUFFER_SIZE;
    if (ringBuffer[idx].epochSec < VALID_EPOCH_MIN) {
      unsigned long elapsedSec = (nowMs - ringBuffer[idx].capturedMs) / 1000UL;
      ringBuffer[idx].epochSec = (unsigned long)nowEpoch - elapsedSec;
    }
  }
}

void connectWiFiInitial() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.printf("[WiFi] Menghubungkan ke %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 24) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  lastWifiAttemptMs = millis();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
    syncNtpTime(NTP_BOOT_TIMEOUT_MS);
  } else {
    Serial.println("\n[WiFi] Offline saat boot — telemetri ditampung di ring-buffer RAM.");
  }
}

void ensureWiFiNonBlocking() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!ntpSynced) {
      time_t nowEpoch = 0;
      time(&nowEpoch);
      if ((unsigned long)nowEpoch >= VALID_EPOCH_MIN) {
        ntpSynced = true;
      }
    }
    return;
  }

  unsigned long nowMs = millis();
  if (nowMs - lastWifiAttemptMs < WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }

  lastWifiAttemptMs = nowMs;
  Serial.println("[WiFi] Mencoba sambung ulang (non-blocking)...");
  WiFi.disconnect(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
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
  if (epochSec < VALID_EPOCH_MIN) {
    return "";
  }
  time_t rawTime = (time_t)epochSec;
  struct tm* timeinfo = gmtime(&rawTime);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buf);
}

bool sendChunk(int countToSend) {
  if (countToSend <= 0 || WiFi.status() != WL_CONNECTED) return false;

  backfillMissingTimestamps();

  JsonDocument doc;
  doc["device_uid"] = DEVICE_UID;
  JsonArray readings = doc["readings"].to<JsonArray>();

  for (int i = 0; i < countToSend; i++) {
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
  int httpCode = -1;

  if (isHttpsEndpoint(SERVER_ENDPOINT)) {
    WiFiClientSecure secureClient;
    if (ALLOW_INSECURE_TLS) {
      secureClient.setInsecure();
    } else {
      secureClient.setCACert(ROOT_CA_ISRG_X1);
    }

    if (!http.begin(secureClient, SERVER_ENDPOINT)) {
      Serial.println("[HTTPS] Gagal inisialisasi koneksi TLS.");
      return false;
    }
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-UID", DEVICE_UID);
    http.addHeader("X-API-Key", DEVICE_API_KEY);
    httpCode = http.POST(payload);
    http.end();
  } else {
    WiFiClient plainClient;
    if (!http.begin(plainClient, SERVER_ENDPOINT)) {
      Serial.println("[HTTP] Gagal inisialisasi koneksi.");
      return false;
    }
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-UID", DEVICE_UID);
    http.addHeader("X-API-Key", DEVICE_API_KEY);
    httpCode = http.POST(payload);
    http.end();
  }

  if (httpCode >= 200 && httpCode < 300) {
    bufferHead = (bufferHead + countToSend) % RING_BUFFER_SIZE;
    bufferCount -= countToSend;
    Serial.printf("[SYNC] Terkirim %d sampel -> HTTP %d (sisa buffer: %d)\n",
                  countToSend, httpCode, bufferCount);
    return true;
  }

  Serial.printf("[SYNC] Gagal kirim (HTTP %d), mempertahankan %d sampel di buffer.\n",
                httpCode, bufferCount);
  return false;
}

void flushRingBuffer() {
  if (bufferCount == 0 || WiFi.status() != WL_CONNECTED) return;

  // Kirim maksimal 2 chunk (50 sampel) per siklus agar backlog offline cepat habis
  int chunksSent = 0;
  while (bufferCount > 0 && chunksSent < 2) {
    int batchSize = bufferCount < MAX_BATCH_PER_REQUEST
                        ? bufferCount
                        : MAX_BATCH_PER_REQUEST;
    if (!sendChunk(batchSize)) {
      break;
    }
    chunksSent++;
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\n=== WattWise ESP32 + PZEM-004T Node (v%s) ===\n", FIRMWARE_VER);
  Serial.printf("Device UID : %s\n", DEVICE_UID);
  Serial.printf("Endpoint   : %s (%s)\n",
                SERVER_ENDPOINT,
                isHttpsEndpoint(SERVER_ENDPOINT) ? "HTTPS TLS" : "HTTP LAN");
  connectWiFiInitial();
  lastFlushMs = millis();
}

void loop() {
  unsigned long nowMs = millis();

  // 1. Sampling PZEM-004T tiap 2 detik (tetap jalan meski Wi-Fi offline)
  if (nowMs - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = nowMs;

    float power = pzem.power();
    float voltage = pzem.voltage();
    float current = pzem.current();
    float energy = pzem.energy();
    float freq = pzem.frequency();
    float pf = pzem.pf();

    if (isnan(power)) {
      Serial.println("[PZEM] Error membaca sensor (cek kabel RX/TX & jalur AC)");
    } else {
      time_t nowEpoch = 0;
      time(&nowEpoch);

      TelemetrySample sample;
      sample.sampleIndex = ++globalSampleIndex;
      sample.epochSec = (unsigned long)nowEpoch;
      sample.capturedMs = nowMs;
      sample.powerW = power;
      sample.voltageV = isnan(voltage) ? 0.0f : voltage;
      sample.currentA = isnan(current) ? 0.0f : current;
      sample.energyKwh = isnan(energy) ? 0.0f : energy;
      sample.frequencyHz = isnan(freq) ? 50.0f : freq;
      sample.powerFactor = isnan(pf) ? 0.0f : pf;

      Serial.printf("[#%lu] P=%.1fW | V=%.1fV | I=%.2fA | E=%.3fkWh | PF=%.2f (buf=%d)\n",
                    sample.sampleIndex,
                    sample.powerW,
                    sample.voltageV,
                    sample.currentA,
                    sample.energyKwh,
                    sample.powerFactor,
                    bufferCount + 1);

      pushToRingBuffer(sample);
    }
  }

  // 2. Jaga koneksi Wi-Fi tanpa memblokir loop sampling
  ensureWiFiNonBlocking();

  // 3. Flush batch tiap 10 detik (5 sampel) atau lebih cepat jika backlog offline >= 15 sampel
  if (bufferCount > 0 &&
      (nowMs - lastFlushMs >= FLUSH_INTERVAL_MS || bufferCount >= 15)) {
    lastFlushMs = nowMs;
    flushRingBuffer();
  }
}
