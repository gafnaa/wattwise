export interface TelegramWorkshopRecord {
  id: string;
  name: string;
  telegramChatId: string | null;
}

export interface TelegramAuthDecision {
  authorized: boolean;
  workshopId: string | null;
  matchedBy: "workshop" | "env_default" | null;
}

/**
 * Memverifikasi apakah `chat_id` Telegram pengirim terdaftar pada salah satu
 * workshop (`workshops.telegram_chat_id`) atau `TELEGRAM_DEFAULT_CHAT_ID`.
 * Mencegah pihak eksternal membaca data energi bengkel atau memicu kuota Gemini AI.
 */
export function resolveAuthorizedTelegramWorkshop(params: {
  incomingChatId: string;
  workshops: readonly TelegramWorkshopRecord[];
  defaultChatId?: string | null;
}): TelegramAuthDecision {
  const incoming = params.incomingChatId.trim();
  if (!incoming) {
    return { authorized: false, workshopId: null, matchedBy: null };
  }

  const matchedWorkshop = params.workshops.find(
    (w) => w.telegramChatId && w.telegramChatId.trim() === incoming
  );
  if (matchedWorkshop) {
    return {
      authorized: true,
      workshopId: matchedWorkshop.id,
      matchedBy: "workshop",
    };
  }

  const envDefault = params.defaultChatId?.trim();
  if (envDefault && envDefault === incoming) {
    return {
      authorized: true,
      workshopId: params.workshops[0]?.id ?? null,
      matchedBy: "env_default",
    };
  }

  return { authorized: false, workshopId: null, matchedBy: null };
}

export function formatUnauthorizedTelegramMessage(chatId: string): string {
  return [
    `🔒 *Akses Ditolak — WattWise Bot*`,
    ``,
    `Chat ID Anda (\`${chatId}\`) belum terdaftar pada bengkel WattWise.`,
    `Jika Anda pemilik atau teknisi bengkel, daftarkan Chat ID tersebut di menu *Pengaturan → Telegram Chat ID* pada dashboard WattWise.`,
  ].join("\n");
}
