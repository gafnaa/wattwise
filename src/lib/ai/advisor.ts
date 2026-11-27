import { z } from "zod";
import type { PeakIdleWindowSummary } from "../audit/peak-idle";
import type {
  GeneratedRecommendation,
  MachineAuditStats,
} from "../audit/recommendations";
import type { DashboardOverviewResponse } from "../dashboard/service";
import {
  calculateWhatIfSavings,
  formatRupiah,
} from "../mock-dashboard-data";

export type AiProviderKind = "gemini" | "openrouter" | "openai" | "none";

export interface AiProviderConfig {
  configured: boolean;
  provider: AiProviderKind;
  model: string | null;
  apiKey: string | null;
}

export interface GroundedRecommendationsInput {
  workshopName: string;
  tariffIdrPerKwh: number;
  workingDaysPerMonth: number;
  stats: readonly MachineAuditStats[];
  peakIdleByMachineId: Record<string, PeakIdleWindowSummary>;
  ruleBasedFallback: readonly GeneratedRecommendation[];
  fetchImpl?: typeof fetch;
}

export interface GroundedRecommendationsResult {
  source: "AI_LLM" | "AI_RULE";
  provider: AiProviderKind | "rule_based_fallback";
  model: string | null;
  recommendations: GeneratedRecommendation[];
  fallbackReason?: string;
}

export interface EnergyQuestionInput {
  question: string;
  overview: DashboardOverviewResponse;
  peakIdleByMachineId?: Record<string, PeakIdleWindowSummary>;
  workshopPeakWindowLabel?: string | null;
  fetchImpl?: typeof fetch;
}

export interface EnergyQuestionResult {
  answerText: string;
  source: "AI_LLM" | "AI_RULE";
  provider: AiProviderKind | "rule_based_fallback";
  model: string | null;
}

const aiRecommendationListSchema = z.object({
  recommendations: z
    .array(
      z.object({
        machineCode: z.string().min(1),
        recommendationText: z.string().min(12).max(280),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
      })
    )
    .min(1),
});

export function getAiProviderConfig(): AiProviderConfig {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      configured: true,
      provider: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
      apiKey: geminiKey,
    };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      configured: true,
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash",
      apiKey: openRouterKey,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      configured: true,
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      apiKey: openAiKey,
    };
  }

  return {
    configured: false,
    provider: "none",
    model: null,
    apiKey: null,
  };
}

/**
 * Membersihkan markdown code fence (```json ... ```) lalu memvalidasi
 * output JSON terstruktur dari LLM menggunakan Zod.
 */
export function parseAiRecommendationResponse(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsedJson = JSON.parse(cleaned) as unknown;
  const normalized = Array.isArray(parsedJson)
    ? { recommendations: parsedJson }
    : parsedJson;

  return aiRecommendationListSchema.parse(normalized);
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

async function callConfiguredLlm(params: {
  config: AiProviderConfig;
  systemPrompt: string;
  userPrompt: string;
  expectJson: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string; usedModel: string }> {
  const { config, systemPrompt, userPrompt, expectJson } = params;
  const doFetch = params.fetchImpl ?? fetch;

  if (!config.configured || !config.apiKey || !config.model) {
    throw new Error("AI provider belum dikonfigurasi");
  }

  if (config.provider === "gemini") {
    const modelsToTry = Array.from(
      new Set([config.model, ...GEMINI_FALLBACK_MODELS])
    );
    let lastError = "Gemini request gagal";

    for (const candidateModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      try {
        const res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: expectJson ? 0.25 : 0.35,
              maxOutputTokens: expectJson ? 2048 : 1400,
              ...(expectJson ? { responseMimeType: "application/json" } : {}),
            },
          }),
        });

        const json = (await res.json().catch(() => ({}))) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
          error?: { message?: string };
        };

        if (!res.ok) {
          lastError = json.error?.message ?? `Gemini HTTP ${res.status}`;
          // Coba model fallback berikutnya bila model 404/429/503
          if (res.status === 404 || res.status === 429 || res.status >= 500) {
            continue;
          }
          throw new Error(lastError);
        }

        const text = json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("")
          .trim();

        if (!text) {
          lastError = "Respons Gemini kosong";
          continue;
        }
        return { text, usedModel: candidateModel };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(lastError);
  }

  const signal = AbortSignal.timeout(15_000);
  const endpoint =
    config.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["X-Title"] = "WattWise Energy Audit";
  }

  const res = await doFetch(endpoint, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      temperature: expectJson ? 0.25 : 0.35,
      max_tokens: expectJson ? 2048 : 1400,
      ...(expectJson ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? `LLM HTTP ${res.status}`);
  }

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Respons LLM kosong");
  }
  return { text, usedModel: config.model };
}

/**
 * Layer 3 (Generative AI): Menerima fakta audit terverifikasi dari kalkulator
 * rule-based + Peak Idle Window, menghasilkan rekomendasi operasional UMKM
 * yang kontekstual. Estimasi Rupiah tetap terkunci ke angka rule-based agar
 * bebas halusinasi angka.
 */
export async function generateGroundedAiRecommendations(
  input: GroundedRecommendationsInput
): Promise<GroundedRecommendationsResult> {
  const config = getAiProviderConfig();
  const baseline = [...input.ruleBasedFallback];

  if (baseline.length === 0) {
    return {
      source: "AI_RULE",
      provider: "rule_based_fallback",
      model: null,
      recommendations: [],
    };
  }

  if (!config.configured) {
    return {
      source: "AI_RULE",
      provider: "rule_based_fallback",
      model: null,
      recommendations: baseline,
      fallbackReason: "API key LLM belum diisi di .env",
    };
  }

  const baselineByCode = new Map(baseline.map((b) => [b.machineCode, b]));

  const verifiedFacts = input.stats
    .filter((s) => baselineByCode.has(s.machineCode))
    .map((s) => {
      const base = baselineByCode.get(s.machineCode)!;
      const peak = input.peakIdleByMachineId[s.machineId];
      return {
        machineCode: s.machineCode,
        machineName: s.machineName,
        machineType: s.machineType,
        idleHoursMonth: s.idleHoursMonth,
        idleKwhMonth: s.idleKwhMonth,
        idleLossIdrMonth: s.idleLossIdrMonth,
        startupCountMonth: s.startupCountMonth,
        verifiedSavingTargetIdrMonth: base.estimatedSavingIdrMonth,
        priority: base.priority,
        peakIdleWindow: peak?.peakWindowLabel ?? null,
        peakIdleSharePct: peak?.peakSharePct ?? null,
      };
    });

  const systemPrompt = [
    "Anda adalah konsultan audit energi listrik spesialis bengkel & pabrik furnitur kayu (UMKM mebel Indonesia) sesuai ISO 14955-5.",
    "Tugas Anda membuat 1 kalimat tindakan operasional yang konkret, praktis, sopan, dan mudah dipahami pemilik/operator bengkel untuk setiap mesin pada data JSON.",
    "Aturan KETAT:",
    "1. JANGAN mengarang angka Rupiah atau kWh di luar data JSON yang diberikan.",
    "2. Sebutkan pola jam rawan idle (`peakIdleWindow`) jika tersedia (misal sebelum istirahat/ganti shift).",
    "3. Maksimal 220 karakter per rekomendasi, Bahasa Indonesia lugas (tanpa jargon rumit).",
    '4. Kembalikan HANYA JSON valid dengan struktur: {"recommendations":[{"machineCode":"...","recommendationText":"...","priority":"HIGH|MEDIUM|LOW"}]}',
  ].join("\n");

  const userPrompt = JSON.stringify({
    workshopName: input.workshopName,
    tariffIdrPerKwh: input.tariffIdrPerKwh,
    workingDaysPerMonth: input.workingDaysPerMonth,
    machines: verifiedFacts,
  });

  try {
    const { text: rawText, usedModel } = await callConfiguredLlm({
      config,
      systemPrompt,
      userPrompt,
      expectJson: true,
      fetchImpl: input.fetchImpl,
    });

    const parsed = parseAiRecommendationResponse(rawText);
    const merged: GeneratedRecommendation[] = [];

    for (const item of parsed.recommendations) {
      const base = baselineByCode.get(item.machineCode);
      if (!base) continue;
      merged.push({
        machineId: base.machineId,
        machineCode: base.machineCode,
        machineName: base.machineName,
        recommendationText: item.recommendationText.trim(),
        // Estimasi Rupiah selalu dikunci pada hasil kalkulator deterministik
        estimatedSavingIdrMonth: base.estimatedSavingIdrMonth,
        priority: item.priority ?? base.priority,
      });
    }

    if (merged.length === 0) {
      throw new Error("Kode mesin dari LLM tidak cocok dengan data terverifikasi");
    }

    // Lengkapi mesin dari baseline yang mungkin terlewat oleh LLM
    const coveredCodes = new Set(merged.map((m) => m.machineCode));
    for (const base of baseline) {
      if (!coveredCodes.has(base.machineCode)) {
        merged.push(base);
      }
    }

    return {
      source: "AI_LLM",
      provider: config.provider,
      model: usedModel,
      recommendations: merged,
    };
  } catch (err) {
    return {
      source: "AI_RULE",
      provider: "rule_based_fallback",
      model: null,
      recommendations: baseline,
      fallbackReason: err instanceof Error ? err.message : "LLM fallback",
    };
  }
}

function buildRuleBasedQuestionFallback(input: EnergyQuestionInput): string {
  const { overview, workshopPeakWindowLabel } = input;
  const sorted = [...overview.machines].sort(
    (a, b) => b.idleLossMonthIdr - a.idleLossMonthIdr
  );
  const top = sorted[0];
  const whatIf30 = calculateWhatIfSavings({
    idleReductionMinPerDay: 30,
    startupReductionPct: 35,
    machines: overview.machines,
    tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
  });

  const lines = [
    `🤖 *Ringkasan Audit Cepat — ${overview.workshop.name}*`,
    ``,
    `• Efisiensi ISO 14955-5: *${overview.metrics.operationalEfficiencyPct}%* (${overview.metrics.efficiencyBadge})`,
    `• Total energi periode ini: *${overview.metrics.totalEnergyKwh} kWh* (${formatRupiah(overview.metrics.totalEnergyCostIdr)})`,
    `• Total kerugian idle: *${formatRupiah(overview.metrics.idleLossIdr)}*`,
  ];

  if (top) {
    lines.push(
      `• Mesin paling boros idle: *${top.name}* (${formatRupiah(top.idleLossMonthIdr)}/bulan, status saat ini \`${top.status}\`)`
    );
  }
  if (workshopPeakWindowLabel) {
    lines.push(`• Jam rawan idle tertinggi: *${workshopPeakWindowLabel}*`);
  }

  lines.push(
    `• Simulasi kurangi idle 30 mnt/hari: hemat *${formatRupiah(whatIf30.totalSavingIdr)}/bulan*`,
    ``,
    `_Tip: ketik /status untuk daya live tiap mesin, /laporan untuk detail lengkap, atau pasang GEMINI_API_KEY agar bot bisa menjawab pertanyaan bebas lebih mendalam._`
  );

  return lines.join("\n");
}

/**
 * Menjawab pertanyaan bahasa alami pemilik bengkel di Telegram berdasarkan
 * data audit live Supabase + hasil kalkulasi rule-based (anti-halusinasi).
 */
export async function answerEnergyQuestionWithAi(
  input: EnergyQuestionInput
): Promise<EnergyQuestionResult> {
  const config = getAiProviderConfig();
  if (!config.configured) {
    return {
      answerText: buildRuleBasedQuestionFallback(input),
      source: "AI_RULE",
      provider: "rule_based_fallback",
      model: null,
    };
  }

  const { overview, peakIdleByMachineId = {}, workshopPeakWindowLabel } = input;
  const whatIf15 = calculateWhatIfSavings({
    idleReductionMinPerDay: 15,
    startupReductionPct: 25,
    machines: overview.machines,
    tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
  });
  const whatIf30 = calculateWhatIfSavings({
    idleReductionMinPerDay: 30,
    startupReductionPct: 35,
    machines: overview.machines,
    tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
    workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
  });

  const groundedContext = {
    workshop: {
      name: overview.workshop.name,
      location: overview.workshop.location,
      tariffIdrPerKwh: overview.workshop.tariffIdrPerKwh,
      workingDaysPerMonth: overview.workshop.workingDaysPerMonth,
      esp32Online: `${overview.workshop.esp32OnlineCount}/${overview.workshop.esp32TotalCount}`,
      workshopPeakIdleWindow: workshopPeakWindowLabel ?? null,
    },
    metrics: overview.metrics,
    virtualSensorNonPriorityW: overview.virtualSensor.currentPowerW,
    machines: overview.machines.map((m) => ({
      code: m.code,
      name: m.name,
      statusLive: m.status,
      currentPowerW: m.currentPowerW,
      ratedPowerW: m.ratedPowerW,
      portfolioQuadrant: m.portfolioQuadrant,
      idleHoursMonth: m.idleHoursMonth,
      idleLossMonthIdr: m.idleLossMonthIdr,
      startupCountMonth: m.startupCountMonth,
      peakIdleWindow: peakIdleByMachineId[m.id]?.peakWindowLabel ?? null,
    })),
    verifiedWhatIfSimulations: {
      reduceIdle15MinPerDaySavingIdrMonth: whatIf15.totalSavingIdr,
      reduceIdle30MinPerDaySavingIdrMonth: whatIf30.totalSavingIdr,
    },
    recentActionLogs: overview.actionLogs.slice(0, 5).map((a) => ({
      machineName: a.machineName,
      status: a.status,
      recommendationText: a.recommendation,
      estimatedSavingIdr: a.estimatedSavingIdr,
    })),
  };

  const systemPrompt = [
    "Anda adalah WattWise AI, asisten audit energi ramah untuk pemilik pabrik & bengkel furnitur kayu Indonesia.",
    "Jawab pertanyaan pengguna dalam Bahasa Indonesia yang ringkas, jelas, dan langsung bisa dipraktikkan di lantai produksi.",
    "Aturan KETAT:",
    "1. Gunakan HANYA angka dari DATA_AUDIT_TERVERIFIKASI. Jangan pernah mengarang angka daya, kWh, atau Rupiah.",
    "2. Jika pengguna bertanya skenario angka yang tidak ada di data, jelaskan estimasi dengan merujuk tarif PLN dan data yang tersedia secara jujur.",
    "3. Format cocok untuk Telegram (maksimal 180 kata, boleh pakai *tebal* dan bullet •, hindari tabel markdown rumit).",
  ].join("\n");

  const userPrompt = `DATA_AUDIT_TERVERIFIKASI:\n${JSON.stringify(groundedContext)}\n\nPERTANYAAN_PENGGUNA:\n${input.question}`;

  try {
    const { text: answerText, usedModel } = await callConfiguredLlm({
      config,
      systemPrompt,
      userPrompt,
      expectJson: false,
      fetchImpl: input.fetchImpl,
    });

    return {
      answerText,
      source: "AI_LLM",
      provider: config.provider,
      model: usedModel,
    };
  } catch {
    return {
      answerText: buildRuleBasedQuestionFallback(input),
      source: "AI_RULE",
      provider: "rule_based_fallback",
      model: null,
    };
  }
}
