import assert from "node:assert/strict";
import test from "node:test";
import {
  answerEnergyQuestionWithAi,
  generateGroundedAiRecommendations,
  parseAiRecommendationResponse,
} from "../ai/advisor";
import { computePeakIdleWindows } from "../audit/peak-idle";
import {
  generateMachineRecommendations,
  type MachineAuditStats,
} from "../audit/recommendations";
import {
  INITIAL_ACTION_LOGS,
  INITIAL_MACHINES,
  PERIOD_METRICS,
  VIRTUAL_SENSOR_SUMMARY,
  WORKSHOP_INFO,
} from "../mock-dashboard-data";

test("computePeakIdleWindows aggregates WIB 2-hour idle buckets accurately", () => {
  // 04:30 UTC = 11:30 WIB (bucket 10:00-12:00 WIB), 05:15 UTC = 12:15 WIB (bucket 12:00-14:00 WIB)
  const analysis = computePeakIdleWindows(
    [
      {
        machineId: "m-edge",
        status: "IDLE",
        startedAt: new Date("2026-11-26T05:15:00.000Z"),
        durationSec: 3600,
      },
      {
        machineId: "m-edge",
        status: "IDLE",
        startedAt: new Date("2026-11-26T05:45:00.000Z"),
        durationSec: 1800,
      },
      {
        machineId: "m-edge",
        status: "IDLE",
        startedAt: new Date("2026-11-26T02:10:00.000Z"),
        durationSec: 900,
      },
      {
        machineId: "m-edge",
        status: "WORKING",
        startedAt: new Date("2026-11-26T02:00:00.000Z"),
        durationSec: 7200,
      },
    ],
    7,
    "WIB"
  );

  assert.equal(analysis.workshopPeakWindowLabel, "12:00-14:00 WIB");
  assert.equal(
    analysis.byMachineId["m-edge"]?.peakWindowLabel,
    "12:00-14:00 WIB"
  );
  assert.equal(analysis.byMachineId["m-edge"]?.peakIdleMinutes, 90);
  assert.equal(analysis.byMachineId["m-edge"]?.peakSharePct, 86);
});

test("parseAiRecommendationResponse handles fenced JSON and rejects invalid payloads", () => {
  const fenced =
    '```json\n{"recommendations":[{"machineCode":"EDGE-01","recommendationText":"Matikan pemanas Edge Bander pukul 12:00-14:00 WIB saat jeda makan siang.","priority":"HIGH"}]}\n```';
  const parsed = parseAiRecommendationResponse(fenced);
  assert.equal(parsed.recommendations.length, 1);
  assert.equal(parsed.recommendations[0]?.machineCode, "EDGE-01");

  assert.throws(() => parseAiRecommendationResponse('{"recommendations":[]}'));
});

test("generateGroundedAiRecommendations falls back safely when API key is unset and uses Gemini when configured", async () => {
  const stats: MachineAuditStats[] = [
    {
      machineId: "m-edge",
      machineCode: "EDGE-01",
      machineName: "Edge Bander Auto",
      machineType: "EDGE_BANDER",
      idleHoursMonth: 48,
      idleKwhMonth: 71,
      idleLossIdrMonth: 1_025_000,
      startupCountMonth: 90,
    },
  ];
  const ruleBased = generateMachineRecommendations(stats);

  const prevGemini = process.env.GEMINI_API_KEY;
  const prevOpenRouter = process.env.OPENROUTER_API_KEY;
  const prevOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const fallbackRes = await generateGroundedAiRecommendations({
      workshopName: "Area Produksi Furnitur",
      tariffIdrPerKwh: 1444.7,
      workingDaysPerMonth: 26,
      stats,
      peakIdleByMachineId: {},
      ruleBasedFallback: ruleBased,
    });
    assert.equal(fallbackRes.source, "AI_RULE");
    assert.equal(fallbackRes.recommendations.length, 1);

    // Mock Gemini live call -> must preserve verified Rupiah saving from rule-based calculator
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      recommendations: [
                        {
                          machineCode: "EDGE-01",
                          recommendationText:
                            "Matikan pemanas Edge Bander Auto sebelum jam 12:00-14:00 WIB dan gabungkan batch pelapisan tepi.",
                          priority: "HIGH",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const llmRes = await generateGroundedAiRecommendations({
      workshopName: "Area Produksi Furnitur",
      tariffIdrPerKwh: 1444.7,
      workingDaysPerMonth: 26,
      stats,
      peakIdleByMachineId: {
        "m-edge": {
          machineId: "m-edge",
          peakWindowLabel: "12:00-14:00 WIB",
          peakIdleMinutes: 120,
          totalIdleMinutes: 200,
          peakSharePct: 60,
        },
      },
      ruleBasedFallback: ruleBased,
      fetchImpl: mockFetch,
    });

    assert.equal(llmRes.source, "AI_LLM");
    assert.equal(llmRes.provider, "gemini");
    assert.equal(
      llmRes.recommendations[0]?.estimatedSavingIdrMonth,
      ruleBased[0]?.estimatedSavingIdrMonth
    );
    assert.match(
      llmRes.recommendations[0]?.recommendationText ?? "",
      /12:00-14:00 WIB/
    );
  } finally {
    if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
    else delete process.env.GEMINI_API_KEY;
    if (prevOpenRouter !== undefined)
      process.env.OPENROUTER_API_KEY = prevOpenRouter;
    if (prevOpenAi !== undefined) process.env.OPENAI_API_KEY = prevOpenAi;
  }
});

test("answerEnergyQuestionWithAi returns grounded fallback when no LLM key is set", async () => {
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevOpenRouter = process.env.OPENROUTER_API_KEY;
  const prevOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const res = await answerEnergyQuestionWithAi({
      question: "Mesin apa yang paling boros bulan ini?",
      overview: {
        dataSource: "demo",
        workshop: {
          id: "ws-1",
          code: WORKSHOP_INFO.code,
          name: WORKSHOP_INFO.name,
          location: WORKSHOP_INFO.location,
          tariffIdrPerKwh: WORKSHOP_INFO.tariffIdrPerKwh,
          workingDaysPerMonth: WORKSHOP_INFO.workingDaysPerMonth,
          esp32OnlineCount: WORKSHOP_INFO.esp32OnlineCount,
          esp32TotalCount: WORKSHOP_INFO.esp32TotalCount,
        },
        metrics: PERIOD_METRICS.month,
        machines: INITIAL_MACHINES,
        virtualSensor: VIRTUAL_SENSOR_SUMMARY,
        actionLogs: INITIAL_ACTION_LOGS,
      },
      workshopPeakWindowLabel: "12:00-14:00 WIB",
    });

    assert.equal(res.source, "AI_RULE");
    assert.match(res.answerText, /Efisiensi ISO 14955-5/);
    assert.match(res.answerText, /12:00-14:00 WIB/);
  } finally {
    if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
    if (prevOpenRouter !== undefined)
      process.env.OPENROUTER_API_KEY = prevOpenRouter;
    if (prevOpenAi !== undefined) process.env.OPENAI_API_KEY = prevOpenAi;
  }
});
