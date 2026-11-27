# WattWise ML Pipeline (Random Forest — ISO 14955-5)

Folder ini berisi pipeline pelatihan dan ekspor model **Random Forest** untuk mengklasifikasikan status operasional mesin mebel menjadi 4 kelas sesuai **ISO 14955-5:2020**:
- `OFF`
- `START_UP`
- `IDLE`
- `WORKING`

## 1. Training Langsung dari Link Google Sheets (CLI)

Pastikan izin berbagi Google Sheets disetel ke **Anyone with the link → Viewer** (atau **Publish to web**), lalu jalankan:

```bash
npm run ml:train -- --sheet="https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit#gid=0"
```

Opsi tambahan yang didukung:
- `--sheet-name="Nama Tab"` — memilih tab tertentu berdasarkan nama (menggunakan endpoint `gviz` CSV).
- `--gid=123456` — memilih tab tertentu berdasarkan `gid`.
- `--rated-power=5500` — kapasitas daya nominal (Watt) jika kolom `rated_power_w` tidak ada di spreadsheet.
- `--auto-label` — opsional bila spreadsheet baru berisi 3 kolom hardware (`index`, `timestamp`, `daya`) tanpa kolom `status`.
- `--csv="./data/sensor.csv"` — melatih dari file CSV lokal.
- Env var `ML_DATASET_SHEET_URL` — alternatif jika ingin menyimpan link spreadsheet di `.env`.

### Format Kolom Spreadsheet yang Didukung (case-insensitive)
- **Wajib:** `daya` (atau `power_w`, `power`, `watt`)
- **Disarankan:** `timestamp` (atau `recorded_at`, `waktu`), `status` (`OFF`, `START_UP`, `IDLE`, `WORKING` — juga menerima alias Bahasa Indonesia `Mati`, `Startup`, `Siaga`, `Bekerja`)
- **Opsional:** `index`, `machine_code` (`kode_mesin`), `rated_power_w` (`kapasitas_w`)

Hasil pelatihan otomatis memperbarui `src/lib/ml/rf-model.json` yang langsung dipakai oleh `src/lib/ml/classifier.ts` (< 1 ms, tanpa server Python terpisah).

## 2. Alur Kerja Google Colab (`scikit-learn` → Next.js)

1. Buka [`ml/wattwise_random_forest.ipynb`](./wattwise_random_forest.ipynb) di [Google Colab](https://colab.research.google.com/).
2. Di **Bagian 1**, tempel link Google Sheets publik pada variabel `SPREADSHEET_URL` (atau aktifkan `USE_UPLOADED_CSV = True` untuk upload CSV lokal, atau biarkan kosong untuk mode simulasi).
3. Jalankan **Run All** → Colab menampilkan kurva daya, *Feature Importance*, dan *Confusion Matrix*, lalu mengunduh **`rf-model.json`**.
4. Salin **`rf-model.json`** ke `src/lib/ml/rf-model.json`.

## 3. Regenerasi Model Baseline Sintetis

```bash
npm run ml:train
```
