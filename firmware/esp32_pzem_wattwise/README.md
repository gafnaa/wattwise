# Firmware Node Sensor WattWise (ESP32 + PZEM-004T v3.0)

Firmware referensi produksi (`v1.1.0`) untuk node sensor mesin prioritas maupun meter induk WattWise.

## Fitur Utama
- **HTTPS TLS (`WiFiClientSecure`)**: Terintegrasi dengan Root CA **ISRG Root X1** (kompatibel langsung dengan domain HTTPS Railway / Let's Encrypt) serta auto-detect HTTP untuk pengujian LAN lokal.
- **Sampling 2 detik + Batch Flush 10 detik**: Membaca PZEM-004T setiap 2 detik (resolusi optimal untuk deteksi `START_UP` Random Forest) dan mengirim batch 5 sampel tiap 10 detik (5× lebih hemat request HTTP, tetap di dalam ambang heartbeat online 30 detik).
- **Sinkronisasi NTP & Backfill Offline**: Menunggu NTP saat boot dan mengisi ulang timestamp sampel offline secara akurat ketika Wi-Fi kembali tersambung.
- **Offline Ring-Buffer (50 sampel) + Chunked Flush (25/request)**: Tetap merekam daya saat Wi-Fi terputus (reconnect non-blocking tiap 15 detik), aman terhadap retry karena backend mendukung deduplikasi `(device_id, recorded_at)`.

## Wiring (UART2 ESP32)
| PZEM-004T v3.0 | ESP32 DevKit |
| :--- | :--- |
| `5V` | `5V` (dari LM2596 Buck Converter / PSU 5V) |
| `GND` | `GND` |
| `TX` | `GPIO 16` (`RX2`) |
| `RX` | `GPIO 17` (`TX2`) |

## Konfigurasi Sebelum Upload
1. Install library **PZEM004Tv30** (`mandulaj`) dan **ArduinoJson** (`v7+`) di Arduino IDE / PlatformIO.
2. Daftarkan node baru lewat dashboard `/devices` (`POST /api/iot/devices`) untuk mendapatkan `DEVICE_UID` dan `DEVICE_API_KEY` produksi yang unik.
3. Sesuaikan konstanta di `esp32_pzem_wattwise.ino`:
   - `WIFI_SSID` & `WIFI_PASS`
   - `SERVER_ENDPOINT` (contoh Railway: `https://<domain-anda>.up.railway.app/api/iot/telemetry`)
   - `DEVICE_UID` & `DEVICE_API_KEY`
4. Mode payload:
   - `MINIMAL_3COL_MODE = false` *(default)* → mengirim seluruh metrik PZEM-004T (`voltage_v`, `current_a`, `power_w`, `energy_kwh`, `frequency_hz`, `power_factor`).
   - `MINIMAL_3COL_MODE = true` → hanya mengirim 3 kolom ringkas (`index`, `timestamp`, `daya`).

## Uji Endpoint Tanpa Hardware (Simulator CLI)
```bash
npm run iot:simulate -- --mode=telemetry --device=ESP32-CNC-1325 --key=ww_dev_cnc_1325_demo
```
Atau simulasi tick seluruh bengkel:
```bash
WATTWISE_API_URL=http://127.0.0.1:3000 npm run iot:simulate -- --mode=demo-tick --scenario=high_idle
```
