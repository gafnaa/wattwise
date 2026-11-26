/**
 * Virtual Sensor Engine — WattWise
 *
 * Mengestimasi konsumsi beban mesin non-prioritas (Kuadran IV Matrix Energy Portfolio)
 * secara agregat dari selisih Meter Induk PLN terhadap total pembacaan sensor fisik
 * pada mesin prioritas:
 *
 *   P_virtual(t) = max(0, P_induk(t) - Σ P_prioritas(t))
 */

export interface PrioritySensorSnapshot {
  machineId: string;
  machineCode: string;
  powerW: number;
  recordedAt: Date | string | number;
}

export interface VirtualSensorResult {
  mainMeterPowerW: number;
  priorityTotalPowerW: number;
  virtualPowerW: number;
  includedSensorCount: number;
  staleSensorCount: number;
  wasClampedToZero: boolean;
}

function toMs(ts: Date | string | number): number {
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return ts.getTime();
  return Date.parse(ts);
}

export function calculateVirtualSensorPower(params: {
  mainMeterPowerW: number;
  mainMeterRecordedAt: Date | string | number;
  priorityReadings: readonly PrioritySensorSnapshot[];
  /** Batas maksimum selisih waktu (detik) agar pembacaan sensor dianggap sinkron */
  maxFreshnessSkewSec?: number;
}): VirtualSensorResult {
  const {
    mainMeterPowerW,
    mainMeterRecordedAt,
    priorityReadings,
    maxFreshnessSkewSec = 15,
  } = params;

  const refMs = toMs(mainMeterRecordedAt);
  const maxSkewMs = maxFreshnessSkewSec * 1000;

  let priorityTotalPowerW = 0;
  let includedSensorCount = 0;
  let staleSensorCount = 0;

  for (const reading of priorityReadings) {
    const readingMs = toMs(reading.recordedAt);
    const skewMs = Math.abs(refMs - readingMs);
    if (Number.isNaN(readingMs) || skewMs > maxSkewMs) {
      staleSensorCount++;
      continue;
    }
    priorityTotalPowerW += Math.max(0, reading.powerW);
    includedSensorCount++;
  }

  const safeMainW = Math.max(0, mainMeterPowerW);
  const rawDiff = safeMainW - priorityTotalPowerW;
  const wasClampedToZero = rawDiff < 0;
  const virtualPowerW = Number(Math.max(0, rawDiff).toFixed(1));

  return {
    mainMeterPowerW: Number(safeMainW.toFixed(1)),
    priorityTotalPowerW: Number(priorityTotalPowerW.toFixed(1)),
    virtualPowerW,
    includedSensorCount,
    staleSensorCount,
    wasClampedToZero,
  };
}
