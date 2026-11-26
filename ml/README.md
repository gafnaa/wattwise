# WattWise ML Pipeline (Random Forest — ISO 14955-5)

Folder ini berisi pipeline pelatihan dan ekspor model **Random Forest** untuk mengklasifikasikan status operasional mesin mebel menjadi 4 kelas sesuai **ISO 14955-5:2020**:
- `OFF`
- `START_UP`
- `IDLE`
- `WORKING`

## Alur Kerja (Google Colab → Next.js)

1. **Buka Notebook di Google Colab:**
   - Upload atau buka [`ml/wattwise_random_forest.ipynb`](./wattwise_random_forest.ipynb) di [Google Colab](https://colab.research.google.com/).
2. **Pilih Sumber Dataset:**
   - **Mode Simulasi (default):** Otomatis membuat dataset profil daya 6 mesin mebel untuk uji pipeline.
   - **Mode CSV Hardware (format 3-kolom dari tim Hardware):** Upload file CSV dengan kolom:
     - `index` *(hanya urutan baris, tidak dipakai jadi fitur ML)*
     - `timestamp` *(ISO-8601 atau format waktu konsisten, idealnya interval 1–2 detik)*
     - `daya` *(atau `power_w`, dalam satuan Watt)*
     - `status` *(label ground-truth: `OFF`, `START_UP`, `IDLE`, `WORKING` untuk training)*
     - Opsional: `rated_power_w` (atau isi parameter kapasitas daya mesin pada cell konfigurasi).
3. **Jalankan Semua Cell (`Run All`):**
   - Colab akan melakukan *feature engineering* (7 fitur *sliding-window* berbasis daya & waktu), melatih `RandomForestClassifier` (`scikit-learn`), menampilkan grafik kurva daya, *Feature Importance*, dan *Confusion Matrix*, lalu mengekspor **`rf-model.json`**.
4. **Pasang Model ke Aplikasi Next.js:**
   - Salin file **`rf-model.json`** yang terunduh dari Colab ke `src/lib/ml/rf-model.json`.
   - Evaluator TypeScript di `src/lib/ml/classifier.ts` langsung menjalankan inferensi model baru (< 1 ms, tanpa server Python terpisah).

## Regenerasi Model Baseline Lokal (Opsional)

Jika ingin meregenerasi model baseline secara deterministik di lokal tanpa Python:

```bash
npx tsx ml/train-baseline.ts
```
