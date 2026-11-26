import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Gunakan DIRECT_URL untuk migrasi di Supabase / Neon (bypass PgBouncer)
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://wattwise:wattwise_dev@localhost:5432/wattwise?schema=public",
  },
});
