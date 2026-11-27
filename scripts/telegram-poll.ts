import "dotenv/config";

/**
 * WattWise Telegram Long-Polling Worker
 *
 * Mengambil pesan masuk dari Telegram Bot API (`getUpdates`) lalu meneruskannya
 * ke endpoint lokal `POST /api/telegram/webhook`. Cocok untuk server privat
 * (localhost / Tailscale tailnet-only) yang tidak terekspos ke internet publik.
 *
 * Penggunaan:
 *   npm run telegram:poll
 */

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: {
      id: number | string;
    };
  };
}

interface TelegramGetUpdatesResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const apiBaseUrl = (
  process.env.WATTWISE_API_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");

if (!token) {
  console.error(
    "[WattWise Telegram Poll] TELEGRAM_BOT_TOKEN belum diset di .env"
  );
  process.exit(1);
}

let running = true;
const abortController = new AbortController();

function handleShutdown(signal: string) {
  console.log(`[WattWise Telegram Poll] Menerima ${signal}, berhenti...`);
  running = false;
  abortController.abort();
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function forwardUpdateToWebhook(update: TelegramUpdate) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (webhookSecret) {
    headers["x-telegram-bot-api-secret-token"] = webhookSecret;
  }

  const res = await fetch(`${apiBaseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
    signal: abortController.signal,
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(
      `[WattWise Telegram Poll] Webhook HTTP ${res.status} untuk update #${update.update_id}: ${bodyText.slice(0, 200)}`
    );
    return;
  }

  const payload = (await res.json().catch(() => ({}))) as {
    command?: string;
    mode?: string;
    ignored?: boolean;
  };
  if (!payload.ignored) {
    console.log(
      `[WattWise Telegram Poll] Update #${update.update_id} (${payload.command ?? "message"}) dibalas (${payload.mode ?? "ok"})`
    );
  }
}

async function main() {
  // Pastikan webhook lama tidak aktif agar long-polling tidak bentrok
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false }),
    signal: abortController.signal,
  }).catch(() => null);

  console.log(
    `[WattWise Telegram Poll] Aktif -> meneruskan pesan masuk ke ${apiBaseUrl}/api/telegram/webhook`
  );

  let offset = 0;

  while (running) {
    try {
      const params = new URLSearchParams({
        timeout: "25",
        allowed_updates: JSON.stringify(["message"]),
      });
      if (offset > 0) {
        params.set("offset", String(offset));
      }

      const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`,
        { signal: abortController.signal }
      );
      const json = (await res.json()) as TelegramGetUpdatesResponse;

      if (!res.ok || !json.ok) {
        console.error(
          `[WattWise Telegram Poll] getUpdates gagal: ${json.description ?? `HTTP ${res.status}`}`
        );
        await sleep(3000);
        continue;
      }

      const updates = json.result ?? [];
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        await forwardUpdateToWebhook(update);
      }
    } catch (err) {
      if (!running) break;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[WattWise Telegram Poll] Error sementara: ${msg}`);
      await sleep(3000);
    }
  }
}

main().catch((err) => {
  console.error("[WattWise Telegram Poll] Fatal error:", err);
  process.exit(1);
});
