# WattWise

**Sistem Audit Energi Pintar Berbasis IoT untuk Pemantauan Status Mesin dan Efisiensi Daya pada UMKM Mebel Skala Menengah.**

## Dokumentasi
- [Product Requirements Document (PRD.md)](./PRD.md)
- [Technical Architecture (ARCHITECTURE.md)](./ARCHITECTURE.md)
- [ML Pipeline & Google Colab Guide (ml/README.md)](./ml/README.md)

## Tech Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Database & ORM:** PostgreSQL (Supabase / Neon / Docker lokal) + Prisma 7 ORM
- **Linting:** ESLint (`eslint-config-next`)

## Menjalankan Secara Lokal

```bash
cp .env.example .env
npm install

# Opsional: jalankan PostgreSQL lokal jika belum memakai Supabase / Neon
docker compose up -d db

# Sinkronkan skema & isi data baseline awal (6 mesin furnitur + virtual sensor)
npm run db:push
npm run db:seed

# Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Scripts
- `npm run dev` / `npm run dev:webpack` — Menjalankan development server
- `npm run build` / `npm run build:webpack` — Build produksi
- `npm run lint` — Menjalankan ESLint
- `npm test` — Menjalankan unit test ML Random Forest & Audit Engine
- `npm run ml:train` — Regenerasi model baseline `src/lib/ml/rf-model.json`
- `npm run db:generate` — Generate Prisma Client
- `npm run db:push` — Push skema Prisma ke PostgreSQL
- `npm run db:migrate` — Jalankan migrasi Prisma
- `npm run db:seed` — Isi data awal (workshop, user demo, 6 mesin + virtual sensor, riwayat 14 hari)
- `npm run db:studio` — Buka Prisma Studio
