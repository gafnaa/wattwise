export interface TelegramSendParams {
  chatId?: string | null;
  text: string;
  parseMode?: "Markdown" | "HTML";
}

export interface TelegramSendResult {
  ok: boolean;
  mode: "live" | "simulated";
  chatId: string | null;
  messageId?: number;
  error?: string;
}

export async function sendTelegramMessage(
  params: TelegramSendParams
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const targetChatId =
    params.chatId?.trim() || process.env.TELEGRAM_DEFAULT_CHAT_ID?.trim() || null;

  // Jika token atau chatId belum diisi di .env, jalankan mode simulasi aman
  if (!token || !targetChatId) {
    return {
      ok: true,
      mode: "simulated",
      chatId: targetChatId,
    };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: params.text,
          parse_mode: params.parseMode ?? "Markdown",
        }),
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        mode: "live",
        chatId: targetChatId,
        error: json.description ?? `HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      mode: "live",
      chatId: targetChatId,
      messageId: json.result?.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      mode: "live",
      chatId: targetChatId,
      error: err instanceof Error ? err.message : "Telegram request failed",
    };
  }
}
