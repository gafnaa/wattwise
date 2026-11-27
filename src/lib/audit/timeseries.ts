export type TimeseriesGranularity = "daily" | "weekly" | "monthly";

export interface SessionEnergySample {
  startedAt: Date;
  status: string;
  energyKwh: number;
}

export interface EnergyTimeseriesPoint {
  bucketKey: string;
  label: string;
  fullDate: string;
  currentKwh: number;
  previousKwh: number;
  workingKwh: number;
  idleKwh: number;
  estCostIdr: number;
}

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const WEEKDAY_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function toShiftedDate(date: Date, utcOffsetHours: number): Date {
  return new Date(date.getTime() + utcOffsetHours * 3_600_000);
}

function dayKey(shiftedDate: Date): string {
  const y = shiftedDate.getUTCFullYear();
  const m = String(shiftedDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shiftedDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(shiftedDate: Date): string {
  const y = shiftedDate.getUTCFullYear();
  const m = String(shiftedDate.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Mengagregasi `MachineStateSession` asli dari database ke deret waktu
 * Harian (14 hari), Mingguan (4 minggu), atau Bulanan (6 bulan) beserta
 * perbandingan periode sebelumnya secara deterministik.
 */
export function buildEnergyTimeseriesFromSessions(params: {
  sessions: readonly SessionEnergySample[];
  granularity: TimeseriesGranularity;
  tariffIdrPerKwh: number;
  now?: Date;
  utcOffsetHours?: number;
}): EnergyTimeseriesPoint[] {
  const {
    sessions,
    granularity,
    tariffIdrPerKwh,
    now = new Date(),
    utcOffsetHours = 7,
  } = params;

  const shiftedNow = toShiftedDate(now, utcOffsetHours);
  const todayMidnightUtcMs = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate()
  );

  if (granularity === "daily") {
    const DAYS = 14;
    const byDay = new Map<
      string,
      { total: number; working: number; idle: number }
    >();

    for (const s of sessions) {
      const kwh = Math.max(0, Number(s.energyKwh) || 0);
      if (kwh <= 0) continue;
      const key = dayKey(toShiftedDate(s.startedAt, utcOffsetHours));
      const acc = byDay.get(key) ?? { total: 0, working: 0, idle: 0 };
      acc.total += kwh;
      if (s.status === "WORKING") acc.working += kwh;
      if (s.status === "IDLE") acc.idle += kwh;
      byDay.set(key, acc);
    }

    const points: EnergyTimeseriesPoint[] = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const curDate = new Date(todayMidnightUtcMs - i * 86_400_000);
      const prevDate = new Date(todayMidnightUtcMs - (i + DAYS) * 86_400_000);
      const curKey = dayKey(curDate);
      const prevKey = dayKey(prevDate);

      const curAcc = byDay.get(curKey) ?? { total: 0, working: 0, idle: 0 };
      const prevAcc = byDay.get(prevKey) ?? { total: 0, working: 0, idle: 0 };

      const dNum = curDate.getUTCDate();
      const mShort = MONTH_SHORT_ID[curDate.getUTCMonth()] ?? "";
      const wName = WEEKDAY_ID[curDate.getUTCDay()] ?? "";
      const year = curDate.getUTCFullYear();

      const currentKwh = Number(curAcc.total.toFixed(1));
      const previousKwh = Number(prevAcc.total.toFixed(1));

      points.push({
        bucketKey: curKey,
        label: i === DAYS - 1 || i === 0 ? `${dNum} ${mShort}` : String(dNum),
        fullDate: `${wName}, ${dNum} ${mShort} ${year}`,
        currentKwh,
        previousKwh,
        workingKwh: Number(curAcc.working.toFixed(1)),
        idleKwh: Number(curAcc.idle.toFixed(1)),
        estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
      });
    }
    return points;
  }

  if (granularity === "weekly") {
    const WEEKS = 4;
    const currentBuckets = Array.from({ length: WEEKS }, () => ({
      total: 0,
      working: 0,
      idle: 0,
    }));
    const prevBuckets = Array.from({ length: WEEKS }, () => 0);

    for (const s of sessions) {
      const kwh = Math.max(0, Number(s.energyKwh) || 0);
      if (kwh <= 0) continue;
      const shifted = toShiftedDate(s.startedAt, utcOffsetHours);
      const sMidnight = Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate()
      );
      const diffDays = Math.floor((todayMidnightUtcMs - sMidnight) / 86_400_000);
      if (diffDays < 0 || diffDays >= WEEKS * 2 * 7) continue;

      if (diffDays < WEEKS * 7) {
        const idx = WEEKS - 1 - Math.floor(diffDays / 7);
        const acc = currentBuckets[idx];
        if (acc) {
          acc.total += kwh;
          if (s.status === "WORKING") acc.working += kwh;
          if (s.status === "IDLE") acc.idle += kwh;
        }
      } else {
        const prevDiff = diffDays - WEEKS * 7;
        const idx = WEEKS - 1 - Math.floor(prevDiff / 7);
        if (idx >= 0 && idx < WEEKS) {
          prevBuckets[idx] += kwh;
        }
      }
    }

    return currentBuckets.map((acc, idx) => {
      const weeksAgo = WEEKS - 1 - idx;
      const endD = new Date(todayMidnightUtcMs - weeksAgo * 7 * 86_400_000);
      const startD = new Date(endD.getTime() - 6 * 86_400_000);
      const currentKwh = Number(acc.total.toFixed(1));
      const previousKwh = Number((prevBuckets[idx] ?? 0).toFixed(1));
      const rangeLabel = `${startD.getUTCDate()} ${MONTH_SHORT_ID[startD.getUTCMonth()]} – ${endD.getUTCDate()} ${MONTH_SHORT_ID[endD.getUTCMonth()]}`;

      return {
        bucketKey: `week-${idx + 1}`,
        label: `Minggu ${idx + 1}`,
        fullDate: `Minggu ${idx + 1} (${rangeLabel})`,
        currentKwh,
        previousKwh,
        workingKwh: Number(acc.working.toFixed(1)),
        idleKwh: Number(acc.idle.toFixed(1)),
        estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
      };
    });
  }

  // Monthly (6 bulan terakhir vs 6 bulan sebelumnya)
  const MONTHS = 6;
  const byMonth = new Map<
    string,
    { total: number; working: number; idle: number }
  >();

  for (const s of sessions) {
    const kwh = Math.max(0, Number(s.energyKwh) || 0);
    if (kwh <= 0) continue;
    const key = monthKey(toShiftedDate(s.startedAt, utcOffsetHours));
    const acc = byMonth.get(key) ?? { total: 0, working: 0, idle: 0 };
    acc.total += kwh;
    if (s.status === "WORKING") acc.working += kwh;
    if (s.status === "IDLE") acc.idle += kwh;
    byMonth.set(key, acc);
  }

  const baseYear = shiftedNow.getUTCFullYear();
  const baseMonth = shiftedNow.getUTCMonth();
  const points: EnergyTimeseriesPoint[] = [];

  for (let i = MONTHS - 1; i >= 0; i -= 1) {
    const curDate = new Date(Date.UTC(baseYear, baseMonth - i, 1));
    const prevDate = new Date(Date.UTC(baseYear, baseMonth - i - MONTHS, 1));
    const curKey = monthKey(curDate);
    const prevKey = monthKey(prevDate);

    const curAcc = byMonth.get(curKey) ?? { total: 0, working: 0, idle: 0 };
    const prevAcc = byMonth.get(prevKey) ?? { total: 0, working: 0, idle: 0 };
    const mShort = MONTH_SHORT_ID[curDate.getUTCMonth()] ?? "";
    const currentKwh = Number(curAcc.total.toFixed(1));

    points.push({
      bucketKey: curKey,
      label: mShort,
      fullDate: `Bulan ${mShort} ${curDate.getUTCFullYear()}`,
      currentKwh,
      previousKwh: Number(prevAcc.total.toFixed(1)),
      workingKwh: Number(curAcc.working.toFixed(1)),
      idleKwh: Number(curAcc.idle.toFixed(1)),
      estCostIdr: Math.round(currentKwh * tariffIdrPerKwh),
    });
  }

  return points;
}
