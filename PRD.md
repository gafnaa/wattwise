# Product Requirements Document (PRD) — WattWise

> **Sistem Audit Energi Pintar Berbasis IoT untuk Pemantauan Status Mesin dan Efisiensi Daya pada UMKM Mebel Skala Menengah**

| Atribut | Detail |
| :--- | :--- |
| **Nama Produk** | WattWise (Smart Energy Audit System) |
| **Program** | Hackathon DeepTech 2026 — Kemendiktisaintek & LPDP (Penyelenggara: UNS) |
| **Subtema** | Subtema C: Manajemen Energi dan Perkotaan |
| **Tim Pengembang** | Tim WattWise — Universitas Gadjah Mada (UGM) |
| **Versi Dokumen** | v1.0 (Initial Architecture & MVP Specification) |
| **Status TKT** | TKT 2 menuju 3 (Purwarupa Terintegrasi untuk Hackathon Day) |
| **Target Demo MVP** | Hackathon Day, 4–6 Desember 2026 |

---

## 1. Latar Belakang & Pernyataan Masalah

### 1.1 Konteks Masalah
Sekitar **68,8% pelaku UMKM** menganggap tarif listrik sebagai salah satu komponen utama yang memengaruhi biaya produksi (Sarasi et al., 2021). Pada usaha mebel skala menengah yang mengoperasikan berbagai mesin listrik (seperti *CNC Router*, *Panel Saw*, *Edge Bander*, *Dust Collector*, *Mesin Bor*, dan *Kompresor*), sebagian besar mesin tetap menyedot daya signifikan saat menyala tanpa memproses material (**kondisi *idle***).

Permasalahan utama yang dihadapi pemilik bengkel mebel saat ini:
1. **Visibilitas Terbatas (Tagihan Agregat):** Pemilik UMKM hanya menerima tagihan listrik bulanan secara agregat dari PLN sehingga tidak dapat mengidentifikasi mesin mana yang menjadi sumber pemborosan maupun kapan konsumsi tidak produktif terjadi.
2. **Hambatan Biaya Perangkat Industri:** *Power Meter Logger* profesional di pasaran berharga sekitar **Rp2.450.000/unit**, terlalu mahal untuk dipasang pada tiap mesin di bengkel UMKM.
3. **Keterbatasan Data & Waktu Teknis:** Data listrik mentah (Watt/Ampere/kWh) sulit langsung diterjemahkan pemilik bengkel menjadi keputusan operasional harian yang konkret.

### 1.2 Referensi Dampak
Studi pada pabrik pengolahan kayu di Vietnam (Dat et al., 2023) membuktikan bahwa pemantauan energi *real-time* yang diikuti perbaikan operasional untuk menekan operasi tanpa beban (*idle*) mampu menghasilkan estimasi penghematan sebesar **191.923 kWh dalam 6 bulan (~5,02%)**. WattWise menghadirkan kapabilitas audit energi serupa dengan biaya *hardware* **hingga ~90% lebih terjangkau** serta antarmuka berbasis AI yang langsung menerjemahkan pemborosan menjadi nilai Rupiah dan saran tindakan.

---

## 2. Tujuan Produk & Metrik Keberhasilan

### 2.1 Tujuan Utama (Product Goals)
1. **Memantau konsumsi daya secara selektif dan hemat biaya** pada mesin prioritas menggunakan node IoT (*ESP32 + PZEM-004T*) serta mengestimasi beban mesin non-prioritas melalui **Virtual Sensor**.
2. **Mengklasifikasikan status operasional mesin secara otomatis** (`OFF`, `START-UP`, `IDLE`, `WORKING`) selaras dengan standar **ISO 14955-5:2020** menggunakan *Machine Learning* (**Random Forest**).
3. **Menerjemahkan data daya menjadi informasi biaya (Rupiah) dan rekomendasi tindakan** yang mudah dipahami pemilik/teknisi bengkel tanpa memerlukan keahlian teknik elektro.
4. **Menyediakan kanal pemantauan dua lapis:** Laporan ringkas & peringatan *urgent* melalui **Telegram Bot**, serta analisis mendalam dan simulasi penghematan melalui **Web Dashboard**.

### 2.2 Indikator Kinerja Utama (KPIs)
| Kategori | Metrik | Target Validasi |
| :--- | :--- | :--- |
| **Efisiensi Energi** | Konsumsi energi spesifik (`kWh / unit output` sejenis) | Menurun dibandingkan *baseline* 2–4 minggu |
| **Reduksi Pemborosan** | Durasi & konsumsi `kWh idle` serta estimasi biaya *idle* bulanan (Rp) | Penurunan terukur pasca penerapan rekomendasi |
| **Akurasi Hardware** | *Error* pembacaan node PZEM-004T terhadap alat ukur referensi | Terverifikasi sesuai batas toleransi alat referensi |
| **Akurasi AI/ML** | Kecocokan klasifikasi status (`OFF/START-UP/IDLE/WORKING`) terhadap observasi lapangan | Validasi tinggi pada pola daya mesin kayu |
| **Usability & Adopsi** | Pemahaman laporan & kesediaan membayar (*Willingness to Pay*) | Pemilik UMKM (5–10 responden) memahami laporan tanpa penjelasan tambahan |

---

## 3. Persona Pengguna & Cakupan Target

1. **Pemilik Usaha Mebel (Primary User / Decision Maker):**
   * Membutuhkan ringkasan biaya pemborosan dalam **Rupiah**, mesin mana yang paling boros, dan rekomendasi penghematan konkret yang cepat dibaca di HP (Telegram) maupun ditinjau di komputer (Dashboard).
2. **Teknisi / Kepala Produksi Bengkel (Operational User):**
   * Membutuhkan status *real-time* mesin (`Working`, `Idle`, `Off`), peringatan segera saat mesin dibiarkan *idle* terlalu lama, serta log tindakan penghematan harian.
3. **Tim Audit / Admin WattWise (Internal Operator):**
   * Mengelola konfigurasi *Matrix Energy Portfolio*, kalibrasi sensor, *mapping* perangkat ESP32, tarif listrik (Rp/kWh), serta ekspor data evaluasi *baseline* vs pasca-intervensi.

**Target Pilot Awal:** 1 bengkel mebel skala menengah di Kabupaten Sukoharjo / Surakarta (dengan penjajakan fasilitasi Disperinaker Kabupaten Sukoharjo), dilanjutkan 2–3 bengkel pada tahap inkubasi.

---

## 4. Arsitektur Sistem (High-Level)

```text
[Mesin Prioritas] ---> (Sensor PZEM-004T + ESP32 + LM2596) --+
                                                             | HTTP/MQTT (JSON Telemetry)
[Meter Induk PLN] ---> (Node Sensor Meter Induk) ------------+--> [Backend API / Data Ingestion]
                                                                          |
                                                                          v
                                                              [Time-Series & Relational DB]
                                                                          |
                                          +-------------------------------+-------------------------------+
                                          |                                                               |
                                          v                                                               v
                           [ML & Analytics Engine]                                         [Web Dashboard (Next.js)]
                      - Virtual Sensor Aggregation                                      - Login & ESP32 Status
                      - Random Forest Classifier (ISO 14955-5)                          - KPI Cards & Live Machine Status
                      - Cost & Idle Loss Calculator (Rp)                                - ISO Ratio & Pareto Charts
                      - AI Action Recommendation Engine                                 - Action Log & What-If Simulator
                                          |
                                          v
                           [Telegram Bot Service (WattWise Bot)]
                      - Laporan Ringkas Berkala
                      - Notifikasi Urgent Anomali Idle
```

### 4.1 Strategi Pengukuran Selektif (*Matrix Energy Portfolio*)
Mengacu pada *Matrix Energy Portfolio* (Thiede et al., 2013) berdasarkan sumbu **Daya Nominal (kW)** dan **Jam Operasi Tahunan (jam/tahun)**:
* **Kuadran II (*Critical Machine* — Daya Tinggi, Jam Operasi Tinggi):** Wajib dipasang node sensor fisik (`PZEM-004T + ESP32`).
* **Kuadran I (*Leverage Power Demand*) & Kuadran III (*Leverage Operating Time*):** Dipasang secara selektif sesuai prioritas biaya bengkel.
* **Kuadran IV (*Noncritical* — Daya Rendah, Jam Operasi Rendah):** Tidak dipasang sensor fisik; konsumsinya dihitung secara agregat melalui **Virtual Sensor**:
  $$P_{\text{virtual}}(t) = \max\left(0,\; P_{\text{induk}}(t) - \sum_{i \in \text{Prioritas}} P_i(t)\right)$$

### 4.2 Spesifikasi Hardware (Node Sensor)
* **Mikrokontroler:** ESP32 DevKit (Wi-Fi + Bluetooth) — ~Rp67.800
* **Sensor Daya:** PZEM-004T v3.0 (Tegangan, Arus, Daya Aktif, Energi, Frekuensi, Faktor Daya) — ~Rp146.965–Rp201.262
* **Catu Daya:** LM2596 DC-DC Step-Down Buck Converter — ~Rp11.812
* **Referensi Rangkaian:** Desain PCB *open-source* Idrus Project (*ESP32 PZEM-004T Power Meter*), disesuaikan dengan sistem kelistrikan bengkel (1-fasa / 3-fasa bersama teknisi listrik).

---

## 5. Kebutuhan Fungsional (Functional Requirements)

### 5.1 Modul Autentikasi & Status Sistem (`FR-AUTH`)
* **Login Page:** Form autentikasi (`Username`, `Password`, opsi `Remember Me`, tautan `Forgot Password`).
* **Indikator Koneksi Perangkat:** Menampilkan status koneksi sistem dan perangkat IoT secara langsung (contoh: `Sistem Terhubung • ESP32 Online / Offline`).

### 5.2 Modul Ingesti Data IoT & Simulator (`FR-IOT`)
* **Telemetry Ingestion API:** Menerima payload telemetri berkala dari ESP32 (`device_id`, `machine_id`, `voltage_v`, `current_a`, `power_w`, `energy_kwh`, `frequency_hz`, `power_factor`, `timestamp`).
* **Virtual Sensor Aggregator:** Menghitung beban non-prioritas secara otomatis dari selisih meter induk terhadap jumlah sensor mesin prioritas.
* **Demo / Dummy Stream Simulator:** Generator data telemetri realistis (profil daya mesin *CNC Router*, *Edge Bander*, *Panel Saw*, *Dust Collector*, *Mesin Bor*, *Kompresor*) untuk pengujian software (TKT 2→3) dan demonstrasi Hackathon Day.

### 5.3 Modul Klasifikasi ML & Audit Energi (`FR-ML`)
* **Klasifikasi Status Mesin (Random Forest):** Mengklasifikasikan jendela data daya/arus menjadi 4 status sesuai **ISO 14955-5**:
  * `OFF`: Mesin mati / konsumsi mendekati 0 W.
  * `START-UP`: Lonjakan arus/daya inisialisasi motor mesin.
  * `IDLE`: Mesin menyala (*spindle*/motor berputar tanpa beban pemotongan/pemrosesan material).
  * `WORKING`: Mesin aktif memproses material kayu dengan profil beban kerja.
* **Kalkulasi Biaya & Kerugian:** Mengonversi durasi & energi (`kWh`) per status ke Rupiah berdasarkan golongan tarif listrik UMKM yang dapat dikonfigurasi (mis. tarif PLN bisnis/industri menengah).
* **Generator Rekomendasi AI:** Menghasilkan rekomendasi tindakan operasional prioritas berbasis mesin dengan kerugian *idle* tertinggi dan pola *start-up* berlebih.

### 5.4 Modul Web Dashboard — *Smart Audit* (`FR-DASH`)
Mengacu pada rancangan antarmuka *dark-mode* industrial (Lampiran 5 Proposal):
1. **Top Navigation & Controls:**
   * Pencarian cepat laporan & mesin (`Ctrl+K`).
   * Badge status live (`IoT Sensor Live`).
   * Filter Lokasi/Area Produksi, Filter Periode Waktu (Hari Ini, Minggu Ini, Bulan Lalu, Custom), dan tombol **Ekspor Data** (CSV/PDF).
2. **Ringkasan KPI Utama (3 Kartu):**
   * **Estimasi Kerugian Daya Idle (Rp):** Total kerugian finansial akibat *idle* pada periode terpilih + keterangan mesin kontributor terbesar.
   * **Efisiensi Daya Operasional (%):** Persentase rasio kerja produktif terhadap total energi aktif + label kategori performa berbasis standar **ISO 14955-5**.
   * **Total Konsumsi Energi (kWh & Rp):** Total kWh terpantau via Meter Induk & Virtual CT beserta estimasi total biaya listrik.
3. **Monitoring Status Mesin Real-Time:**
   * Tab filter: `Semua`, `Working`, `Idle`, (`Off`).
   * Grid kartu mesin (contoh: *CNC Router 1325*, *Edge Bander Auto*, *Panel Saw Sliding*, *Dust Collector*, *Mesin Bor/Boring*, *Kompresor 5HP*) menampilkan status badge, daya/durasi terkini, dan akses rincian per mesin.
4. **Rasio & Pareto Energi Mesin:**
   * **Proporsi Daya (Status ISO):** Grafik donat persentase `Working`, `Idle`, dan `Start-up`.
   * **Mesin Paling Boros (Pareto):** Grafik batang horizontal mengurutkan mesin berdasarkan *Biaya Kerugian Idle (Rp)* terbesar.
5. **Log Tindakan Otomatisasi & Rekomendasi:**
   * Tabel berisi: `Tanggal`, `Mesin Furnitur`, `Rekomendasi Aksi`, `Status` (`Selesai` / `Pending`), dan `Estimasi Hemat (Rp)`.
6. **Simulator Hemat "What-If":**
   * Kontrol interaktif (*slider*):
     * *Kurangi Waktu Idle Mesin* (mis. `0–60 menit/hari`).
     * *Kurangi Start-up Berlebih* (frekuensi/persentase).
   * Kalkulasi *real-time* **Estimasi Penghematan Tambahan (Rp / bulan)**.
   * Tombol **Kirim Laporan** untuk mendorong hasil ringkasan & simulasi langsung ke Telegram pemilik.

### 5.5 Modul Telegram Bot — `WattWise Bot` (`FR-TG`)
* **Command Interaktif:**
  * `/start` — Registrasi / pengenalan bot dan ringkasan cepat.
  * `/status` — Ringkasan status mesin aktif saat ini.
  * `/laporan` — Laporan hemat energi periode berjalan.
* **Format Laporan Ringkas:** Menampilkan total potensi kerugian *idle* bulan berjalan (Rp), saran tindakan utama (mesin prioritas & durasi pengurangan *idle*), serta estimasi penghematan bulanan (Rp/bulan).
* **Alert Urgent Otomatis:** Mengirim notifikasi proaktif ketika durasi atau kerugian *idle* melewati ambang batas (*threshold*) yang ditentukan, mengarahkan pemilik membuka Dashboard untuk investigasi detail.

### 5.6 Modul Manajemen Mesin & Baseline (`FR-ADMIN`)
* Pengaturan daftar mesin, kategori *Matrix Energy Portfolio* (Prioritas / Non-prioritas), *threshold* idle per mesin, tarif listrik (Rp/kWh), serta pencatatan volume/jenis produksi untuk menghitung `kWh / unit output` pada evaluasi sebelum–sesudah.

---

## 6. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Performa & Real-Time Responsiveness:**
   * Pembaruan status mesin di Dashboard maksimal latensi < 5 detik dari penerimaan telemetri.
   * Waktu muat halaman utama Dashboard < 2 detik pada jaringan standar bengkel.
2. **Keandalan & Toleransi Gangguan Jaringan:**
   * ESP32 mendukung *reconnect* otomatis; backend menandai status perangkat `Offline` jika tidak ada *heartbeat* melewati batas waktu tertentu.
3. **Keamanan:**
   * Autentikasi sesi aman untuk Dashboard, proteksi *API Key* / token untuk endpoint ingest ESP32, serta penyimpanan kredensial sensitif (token Telegram, DB URL) melalui *environment variables*.
4. **Keterbacaan & Aksesibilitas:**
   * Bahasa Indonesia yang lugas dan non-teknis bagi pelaku UMKM (menonjolkan nilai Rupiah dan aksi konkret).
   * Responsif untuk layar desktop/laptop bengkel dan dapat diakses rapi di perangkat mobile.
5. **Skalabilitas Biaya:**
   * Arsitektur perangkat lunak ringan sehingga dapat dijalankan dengan biaya *hosting* rendah agar mendukung model langganan UMKM yang terjangkau.

---

## 7. Rencana Tech Stack & Arsitektur Bertahap

Pengembangan dilakukan secara bertahap agar siap untuk demonstrasi **Hackathon Day** sekaligus mudah dikembangkan menuju tahap inkubasi:

| Lapisan | Teknologi | Peran |
| :--- | :--- | :--- |
| **Frontend & App Framework** | **Next.js (App Router), TypeScript, Tailwind CSS** | Web Dashboard (*Smart Audit*), Login, Simulator *What-If*, serta API Routes |
| **Visualisasi Data** | Charting library berbasis React (mis. Recharts / Chart.js) & ikon (Lucide) | Donut Chart Status ISO, Pareto Bar Chart, tren daya mesin |
| **Backend & Database** | Next.js API Routes / Node.js + **PostgreSQL (Supabase / Neon) + Prisma ORM** | Ingest telemetri ESP32, kalkulasi Virtual Sensor, log tindakan, konfigurasi |
| **AI / Machine Learning** | Python (`scikit-learn` Random Forest) / inference service | Klasifikasi status mesin ISO 14955-5 & rekomendasi aksi berbasis aturan/AI |
| **Notifikasi** | Telegram Bot API (`WattWise Bot`) | Laporan berkala & *urgent idle alerts* |
| **Edge / Firmware** | ESP32 (Arduino / PlatformIO) + PZEM-004T | Akuisisi data listrik & pengiriman JSON via HTTP/MQTT |

---

## 8. Roadmap & Tahapan Pengembangan

### Tahap 1 — Fondasi & Arsitektur (Saat Ini)
- [x] Inisialisasi boilerplate **Next.js + TypeScript + Tailwind CSS**
- [x] Penyusunan **PRD v1.0** & repositori GitHub
- [x] Perancangan skema database, kontrak API telemetri ESP32, dan desain arsitektur detail ([ARCHITECTURE.md](./ARCHITECTURE.md))

### Tahap 2 — Purwarupa Software & ML (Menuju 29 Nov 2026)
- [ ] Implementasi UI Login & Dashboard *Smart Audit* sesuai mockup Lampiran 5
- [ ] Implementasi simulator data sensor & kalkulasi Virtual Sensor + biaya (Rp)
- [ ] Implementasi model klasifikasi **Random Forest** (`OFF`, `START-UP`, `IDLE`, `WORKING`)
- [ ] Implementasi **Simulator "What-If"** & integrasi **Telegram Bot (`WattWise Bot`)**

### Tahap 3 — Integrasi Hardware–Software & Hackathon Day (29 Nov – 6 Des 2026)
- [ ] Integrasi payload nyata dari node **ESP32 + PZEM-004T**
- [ ] Uji validasi pembacaan terhadap alat referensi & uji awal bengkel (2–3 Des)
- [ ] Demonstrasi *end-to-end* pada **Hackathon Day (4–6 Des 2026)**

### Tahap 4 — Inkubasi & Perluasan (Jan – Des 2027)
- [ ] Pengukuran *baseline* 2–4 minggu & verifikasi perangkat di 2–3 bengkel mebel (Jan–Feb 2027)
- [ ] Kalibrasi klasifikasi, uji keterpahaman laporan, & penetapan target (Feb 2027)
- [ ] Pilot penerapan rekomendasi penghematan (Mar–Apr 2027) & evaluasi sebelum–sesudah (Mei 2027)
- [ ] Perluasan ke bengkel mebel lain & penjajakan UMKM sektor manufaktur serupa (Agu–Des 2027)

---

## 9. Pembagian Peran Tim

| Peran | Nama | Tanggung Jawab Utama |
| :--- | :--- | :--- |
| **Ketua / Dosen Pembimbing** | Prof. Ir. Anna Maria Sri Asih, Ph.D. | Pengarah riset, evaluasi metode & hasil pengujian |
| **Koordinator Teknis** | Gilang Luhung Pratama | Arsitektur sistem, jadwal, integrasi hardware–software |
| **Anggota Teknis 1 (Hardware)** | Sulaiman Muhammad Nazhmi | Desain/perakitan node sensor (ESP32 + PZEM-004T), verifikasi alat referensi |
| **Anggota Teknis 2 (Software)** | Gafna Al Faatiha Prabowo | Pengolahan data, klasifikasi ML, perhitungan biaya, Web Dashboard, Bot Telegram |
| **Koordinator Bisnis** | Duma Henita Zipora Sumbayak | BMC, analisis biaya & harga, strategi pasar & validasi kesediaan membayar |
| **Koordinator Validasi** | Dinggan Langhita Gampang | Koordinasi mitra UMKM/Disperinaker, wawancara, pencatatan *baseline* & evaluasi |
