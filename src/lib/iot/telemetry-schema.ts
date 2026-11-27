import { z } from "zod";

/**
 * Mendukung 2 format payload ESP32:
 * 1) Format ringkas 3-kolom hardware (index, timestamp, daya / power_w)
 * 2) Format lengkap PZEM-004T (`metrics: { voltage_v, current_a, power_w, ... }`)
 */
export const telemetryItemSchema = z
  .object({
    device_uid: z.string().min(1).optional(),
    index: z.number().int().optional(),
    sample_index: z.number().int().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    recorded_at: z.union([z.string(), z.number()]).optional(),
    daya: z.number().nonnegative().optional(),
    power_w: z.number().nonnegative().optional(),
    firmware_version: z.string().optional(),
    is_simulated: z.boolean().optional(),
    metrics: z
      .object({
        voltage_v: z.number().nonnegative().optional(),
        current_a: z.number().nonnegative().optional(),
        power_w: z.number().nonnegative(),
        energy_kwh: z.number().nonnegative().optional(),
        frequency_hz: z.number().nonnegative().optional(),
        power_factor: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .refine(
    (item) =>
      typeof (item.metrics?.power_w ?? item.power_w ?? item.daya) === "number",
    {
      message:
        "Minimal satu field daya (metrics.power_w, power_w, atau daya) wajib diisi.",
    }
  );

export const telemetryBatchSchema = z.object({
  device_uid: z.string().min(1).optional(),
  readings: z.array(telemetryItemSchema).min(1).max(100),
});

// Batch harus dicek lebih dulu agar objek `{ device_uid, readings: [...] }`
// selalu terurai sebagai batch, bukan ter-strip menjadi item tunggal.
export const telemetryBodySchema = z.union([
  telemetryBatchSchema,
  telemetryItemSchema,
]);
