import "dotenv/config";

/**
 * WattWise Daily Cron Runner
 * Memicu `POST /api/cron/daily-summary` (ringkasan harian Telegram + retensi 30 hari).
 *
 * Penggunaan:
 *   npm run cron:daily
 *   # atau di crontab Linux (setiap hari 07:00 WIB):
 *   # 0 7 * * * cd /var/gafna/wattwise && npm run cron:daily >> /var/log/wattwise-cron.log 2>&1
 */

const baseUrl = (
  process.env.WATTWISE_API_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

async function main() {
  if (!cronSecret) {
    console.error("[WattWise Cron] CRON_SECRET belum diset di .env");
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/api/cron/daily-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": cronSecret,
    },
    body: JSON.stringify({ retentionDays: 30 }),
  });

  const json = await res.json().catch(() => ({}));
  console.log(`[WattWise Cron] HTTP ${res.status}:`, JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error("[WattWise Cron Error]", err);
  process.exit(1);
});
