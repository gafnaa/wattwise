import type { MachineStatus } from "../ml/types";

export interface IdleSessionLike {
  machineId: string;
  status: MachineStatus | string;
  startedAt: Date;
  durationSec: number;
}

export interface PeakIdleWindowSummary {
  machineId: string;
  peakWindowLabel: string;
  peakIdleMinutes: number;
  totalIdleMinutes: number;
  peakSharePct: number;
}

export interface WorkshopPeakIdleAnalysis {
  byMachineId: Record<string, PeakIdleWindowSummary>;
  workshopPeakWindowLabel: string | null;
}

function getLocalHour(date: Date, utcOffsetHours: number): number {
  const shiftedMs = date.getTime() + utcOffsetHours * 3_600_000;
  return new Date(shiftedMs).getUTCHours();
}

function formatTwoHourBucket(startHour: number, tzLabel: string): string {
  const normalizedStart = ((startHour % 24) + 24) % 24;
  const endHour = (normalizedStart + 2) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(normalizedStart)}:00-${pad(endHour)}:00 ${tzLabel}`;
}

/**
 * Mengelompokkan durasi sesi IDLE ke blok 2-jam (default WIB / UTC+7)
 * agar Generative AI mengetahui jam rawan pemborosan per mesin secara faktual.
 */
export function computePeakIdleWindows(
  sessions: readonly IdleSessionLike[],
  utcOffsetHours = 7,
  tzLabel = "WIB"
): WorkshopPeakIdleAnalysis {
  const machineBuckets = new Map<string, Map<number, number>>();
  const workshopBuckets = new Map<number, number>();

  for (const session of sessions) {
    if (session.status !== "IDLE" || session.durationSec <= 0) continue;

    const hour = getLocalHour(session.startedAt, utcOffsetHours);
    const bucketStart = Math.floor(hour / 2) * 2;
    const minutes = session.durationSec / 60;

    let perMachine = machineBuckets.get(session.machineId);
    if (!perMachine) {
      perMachine = new Map<number, number>();
      machineBuckets.set(session.machineId, perMachine);
    }
    perMachine.set(bucketStart, (perMachine.get(bucketStart) ?? 0) + minutes);
    workshopBuckets.set(
      bucketStart,
      (workshopBuckets.get(bucketStart) ?? 0) + minutes
    );
  }

  const byMachineId: Record<string, PeakIdleWindowSummary> = {};

  for (const [machineId, buckets] of machineBuckets.entries()) {
    let bestBucket = 8;
    let bestMinutes = 0;
    let totalMinutes = 0;

    for (const [bucket, mins] of buckets.entries()) {
      totalMinutes += mins;
      if (mins > bestMinutes) {
        bestMinutes = mins;
        bestBucket = bucket;
      }
    }

    if (totalMinutes > 0) {
      byMachineId[machineId] = {
        machineId,
        peakWindowLabel: formatTwoHourBucket(bestBucket, tzLabel),
        peakIdleMinutes: Math.round(bestMinutes),
        totalIdleMinutes: Math.round(totalMinutes),
        peakSharePct: Math.round((bestMinutes / totalMinutes) * 100),
      };
    }
  }

  let workshopPeakWindowLabel: string | null = null;
  let workshopBestMins = 0;
  for (const [bucket, mins] of workshopBuckets.entries()) {
    if (mins > workshopBestMins) {
      workshopBestMins = mins;
      workshopPeakWindowLabel = formatTwoHourBucket(bucket, tzLabel);
    }
  }

  return {
    byMachineId,
    workshopPeakWindowLabel,
  };
}
