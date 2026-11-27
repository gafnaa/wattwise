import { connection, NextResponse } from "next/server";
import { getAiProviderConfig } from "@/lib/ai/advisor";
import { db } from "@/lib/db";
import { getActiveRfModel } from "@/lib/ml/classifier";

export async function GET() {
  await connection();
  const model = getActiveRfModel();
  const aiConfig = getAiProviderConfig();
  let database: "connected" | "demo-fallback" = "demo-fallback";

  try {
    await db.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "demo-fallback";
  }

  return NextResponse.json({
    ok: true,
    service: "wattwise-backend",
    timestamp: new Date().toISOString(),
    database,
    mlModel: {
      modelType: model.modelType,
      version: model.version,
      standard: model.standard,
      nEstimators: model.nEstimators,
      testAccuracy: model.metrics?.testAccuracy ?? null,
    },
    aiAdvisor: {
      configured: aiConfig.configured,
      provider: aiConfig.provider,
      model: aiConfig.model,
    },
    telegram: {
      configured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN?.trim() &&
          process.env.TELEGRAM_DEFAULT_CHAT_ID?.trim()
      ),
    },
  });
}
