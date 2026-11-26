# Firmware Node Sensor WattWise (ESP32 + PZEM-004T v3.0)

Firmware referensi untuk kolaborasi tim Hardware & Software WattWise.

## Wiring (UART2 ESP32)
| PZEM-004T v3.0 | ESP32 DevKit |
| :--- | :--- |
| `5V` | `5V` (dari LM2596 Buck Converter) |
| `GND` | `GND` |
| `TX` | `GPIO 16` (`RX2`) |
| `RX` | `GPIO 17` (`TX2`) |

## Konfigurasi Sebelum Upload
1. Install library **PZEM004Tv30** (`mandulaj`) dan **ArduinoJson** (v7+) di Arduino IDE / PlatformIO.
2. Ubah variabel berikut pada `esp32_pzem_wattwise.ino`:
   - `WIFI_SSID` & `WIFI_PASS`
   - `SERVER_ENDPOINT` (mis. `https://<domain-anda>/api/iot/telemetry`)
   - `DEVICE_UID` & `DEVICE_API_KEY` (buat node baru lewat `POST /api/iot/devices` atau gunakan kredensial demo dari `prisma/seed.ts`).
3. Mode payload:
   - `MINIMAL_3COL_MODE = true` → hanya mengirim `index`, `timestamp`, dan `daya` (Watt).
   - `MINIMAL_3COL_MODE = false` → mengirim seluruh metrik PZEM-004T (`voltage_v`, `current_a`, `power_w`, `energy_kwh`, `frequency_hz`, `power_factor`).

## Uji Endpoint Tanpa Hardware (Simulator CLI)
```bash
npm run iot:simulate
```
Atau arahkan ke server tertentu:
```bash
WATTWISE_API_URL=http://127.0.0.1:3000 npm run iot:simulate -- --mode=demo-tick --scenario=high_idle
```
