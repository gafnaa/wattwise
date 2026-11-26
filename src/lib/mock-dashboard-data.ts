export type MachineStatus = "WORKING" | "IDLE" | "START_UP" | "OFF";

export type PortfolioQuadrant =
  | "CRITICAL"
  | "LEVERAGE_POWER"
  | "LEVERAGE_TIME"
  | "NONCRITICAL";

export type RecommendationStatus = "PENDING" | "COMPLETED";

export type DateRangeKey = "month" | "week" | "today";

export interface TelemetryPoint {
  time: string;
  powerW: number;
  status: MachineStatus;
}

export interface MachineCardData {
  id: string;
  code: string;
  name: string;
  categoryLabel: string;
  status: MachineStatus;
  currentPowerW: number;
  ratedPowerW: number;
  baselineIdleW: number;
  baselineWorkingW: number;
  voltageV: number;
  currentA: number;
  powerFactor: number;
  sessionDurationSec: number;
  idleAlertThresholdMin: number;
  portfolioQuadrant: PortfolioQuadrant;
  hasPhysicalSensor: boolean;
  deviceUid: string | null;
  idleLossMonthIdr: number;
  idleHoursMonth: number;
  workingHoursMonth: number;
  startupCountMonth: number;
  sparkline: TelemetryPoint[];
}

export interface ActionLogItem {
  id: string;
  dateLabel: string;
  machineCode: string;
  machineName: string;
  recommendation: string;
  status: RecommendationStatus;
  estimatedSavingIdr: number;
}

export interface PeriodMetrics {
  label: string;
  idleLossIdr: number;
  idleLossDeltaPct: number;
  topWasteMachine: string;
  operationalEfficiencyPct: number;
  efficiencyBadge: "Sangat Baik" | "Baik" | "Perlu Perbaikan";
  totalEnergyKwh: number;
  totalEnergyCostIdr: number;
  virtualSensorShareKwh: number;
  isoDistribution: Array<{
    key: "working" | "idle" | "startup";
    label: string;
    kwh: number;
    pct: number;
    color: string;
  }>;
  paretoScale: number;
}

export const WORKSHOP_INFO = {
  code: "WS-SKH-01",
  name: "Area Produksi Furnitur",
  location: "Sentra Mebel Trangsan, Sukoharjo",
  tariffIdrPerKwh: 1444.7,
  workingDaysPerMonth: 26,
  ownerName: "Pemilik Pabrik",
  ownerRole: "Admin Utama",
  esp32OnlineCount: 7,
  esp32TotalCount: 7,
};

export const PERIOD_METRICS: Record<DateRangeKey, PeriodMetrics> = {
  month: {
    label: "Bulan Lalu (Okt 2026)",
    idleLossIdr: 4_120_000,
    idleLossDeltaPct: -8.4,
    topWasteMachine: "Panel Saw Sliding & Edge Bander Auto",
    operationalEfficiencyPct: 74,
    efficiencyBadge: "Sangat Baik",
    totalEnergyKwh: 1_580,
    totalEnergyCostIdr: 2_330_000,
    virtualSensorShareKwh: 142,
    isoDistribution: [
      { key: "working", label: "Working", kwh: 1_169, pct: 74, color: "#10b981" },
      { key: "idle", label: "Idle", kwh: 316, pct: 20, color: "#f59e0b" },
      { key: "startup", label: "Start-up", kwh: 95, pct: 6, color: "#f97316" },
    ],
    paretoScale: 1,
  },
  week: {
    label: "7 Hari Terakhir",
    idleLossIdr: 1_045_000,
    idleLossDeltaPct: -11.2,
    topWasteMachine: "Panel Saw Sliding",
    operationalEfficiencyPct: 76,
    efficiencyBadge: "Sangat Baik",
    totalEnergyKwh: 412,
    totalEnergyCostIdr: 595_216,
    virtualSensorShareKwh: 38,
    isoDistribution: [
      { key: "working", label: "Working", kwh: 313, pct: 76, color: "#10b981" },
      { key: "idle", label: "Idle", kwh: 74, pct: 18, color: "#f59e0b" },
      { key: "startup", label: "Start-up", kwh: 25, pct: 6, color: "#f97316" },
    ],
    paretoScale: 0.25,
  },
  today: {
    label: "Hari Ini (Live)",
    idleLossIdr: 162_400,
    idleLossDeltaPct: -4.1,
    topWasteMachine: "Edge Bander Auto",
    operationalEfficiencyPct: 72,
    efficiencyBadge: "Baik",
    totalEnergyKwh: 68.4,
    totalEnergyCostIdr: 98_817,
    virtualSensorShareKwh: 6.2,
    isoDistribution: [
      { key: "working", label: "Working", kwh: 49.2, pct: 72, color: "#10b981" },
      { key: "idle", label: "Idle", kwh: 14.4, pct: 21, color: "#f59e0b" },
      { key: "startup", label: "Start-up", kwh: 4.8, pct: 7, color: "#f97316" },
    ],
    paretoScale: 0.04,
  },
};

export const INITIAL_MACHINES: MachineCardData[] = [
  {
    id: "m-cnc-1325",
    code: "CNC-1325",
    name: "CNC Router 1325",
    categoryLabel: "Pemotongan Presisi",
    status: "WORKING",
    currentPowerW: 4420,
    ratedPowerW: 5500,
    baselineIdleW: 1650,
    baselineWorkingW: 4450,
    voltageV: 221.3,
    currentA: 21.8,
    powerFactor: 0.92,
    sessionDurationSec: 8320,
    idleAlertThresholdMin: 15,
    portfolioQuadrant: "CRITICAL",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-CNC-1325",
    idleLossMonthIdr: 865_000,
    idleHoursMonth: 46.8,
    workingHoursMonth: 140.4,
    startupCountMonth: 104,
    sparkline: [
      { time: "09:10", powerW: 1680, status: "IDLE" },
      { time: "09:15", powerW: 4820, status: "START_UP" },
      { time: "09:20", powerW: 4380, status: "WORKING" },
      { time: "09:25", powerW: 4510, status: "WORKING" },
      { time: "09:30", powerW: 4290, status: "WORKING" },
      { time: "09:35", powerW: 4620, status: "WORKING" },
      { time: "09:40", powerW: 4420, status: "WORKING" },
    ],
  },
  {
    id: "m-edge-01",
    code: "EDGE-01",
    name: "Edge Bander Auto",
    categoryLabel: "Pelapisan Tepi",
    status: "IDLE",
    currentPowerW: 1480,
    ratedPowerW: 4200,
    baselineIdleW: 1480,
    baselineWorkingW: 3350,
    voltageV: 220.8,
    currentA: 12.1,
    powerFactor: 0.55,
    sessionDurationSec: 2055,
    idleAlertThresholdMin: 15,
    portfolioQuadrant: "CRITICAL",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-EDGE-01",
    idleLossMonthIdr: 1_040_000,
    idleHoursMonth: 59.8,
    workingHoursMonth: 111.8,
    startupCountMonth: 130,
    sparkline: [
      { time: "09:10", powerW: 3310, status: "WORKING" },
      { time: "09:15", powerW: 3420, status: "WORKING" },
      { time: "09:20", powerW: 1510, status: "IDLE" },
      { time: "09:25", powerW: 1475, status: "IDLE" },
      { time: "09:30", powerW: 1490, status: "IDLE" },
      { time: "09:35", powerW: 1470, status: "IDLE" },
      { time: "09:40", powerW: 1480, status: "IDLE" },
    ],
  },
  {
    id: "m-psaw-01",
    code: "PSAW-01",
    name: "Panel Saw Sliding",
    categoryLabel: "Gergaji Panel Utama",
    status: "IDLE",
    currentPowerW: 1320,
    ratedPowerW: 3800,
    baselineIdleW: 1320,
    baselineWorkingW: 3150,
    voltageV: 219.9,
    currentA: 11.4,
    powerFactor: 0.53,
    sessionDurationSec: 1730,
    idleAlertThresholdMin: 15,
    portfolioQuadrant: "CRITICAL",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-PSAW-01",
    idleLossMonthIdr: 1_195_000,
    idleHoursMonth: 67.6,
    workingHoursMonth: 106.6,
    startupCountMonth: 156,
    sparkline: [
      { time: "09:10", powerW: 3080, status: "WORKING" },
      { time: "09:15", powerW: 3190, status: "WORKING" },
      { time: "09:20", powerW: 1340, status: "IDLE" },
      { time: "09:25", powerW: 1315, status: "IDLE" },
      { time: "09:30", powerW: 1325, status: "IDLE" },
      { time: "09:35", powerW: 1310, status: "IDLE" },
      { time: "09:40", powerW: 1320, status: "IDLE" },
    ],
  },
  {
    id: "m-dust-01",
    code: "DUST-01",
    name: "Dust Collector",
    categoryLabel: "Penyedot Debu Kayu",
    status: "OFF",
    currentPowerW: 4,
    ratedPowerW: 2200,
    baselineIdleW: 920,
    baselineWorkingW: 1850,
    voltageV: 221.0,
    currentA: 0.05,
    powerFactor: 0.12,
    sessionDurationSec: 4320,
    idleAlertThresholdMin: 20,
    portfolioQuadrant: "LEVERAGE_TIME",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-DUST-01",
    idleLossMonthIdr: 475_000,
    idleHoursMonth: 39.0,
    workingHoursMonth: 124.8,
    startupCountMonth: 104,
    sparkline: [
      { time: "09:10", powerW: 1820, status: "WORKING" },
      { time: "09:15", powerW: 910, status: "IDLE" },
      { time: "09:20", powerW: 4, status: "OFF" },
      { time: "09:25", powerW: 3, status: "OFF" },
      { time: "09:30", powerW: 4, status: "OFF" },
      { time: "09:35", powerW: 4, status: "OFF" },
      { time: "09:40", powerW: 4, status: "OFF" },
    ],
  },
  {
    id: "m-bor-01",
    code: "BOR-01",
    name: "Mesin Bor (Boring)",
    categoryLabel: "Pelubangan Dowel",
    status: "WORKING",
    currentPowerW: 1410,
    ratedPowerW: 1800,
    baselineIdleW: 480,
    baselineWorkingW: 1420,
    voltageV: 220.4,
    currentA: 7.2,
    powerFactor: 0.89,
    sessionDurationSec: 3922,
    idleAlertThresholdMin: 20,
    portfolioQuadrant: "LEVERAGE_POWER",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-BOR-01",
    idleLossMonthIdr: 285_000,
    idleHoursMonth: 28.6,
    workingHoursMonth: 88.4,
    startupCountMonth: 130,
    sparkline: [
      { time: "09:10", powerW: 470, status: "IDLE" },
      { time: "09:15", powerW: 1490, status: "WORKING" },
      { time: "09:20", powerW: 1380, status: "WORKING" },
      { time: "09:25", powerW: 1440, status: "WORKING" },
      { time: "09:30", powerW: 1395, status: "WORKING" },
      { time: "09:35", powerW: 1430, status: "WORKING" },
      { time: "09:40", powerW: 1410, status: "WORKING" },
    ],
  },
  {
    id: "m-comp-5hp",
    code: "COMP-5HP",
    name: "Kompresor 5HP",
    categoryLabel: "Suplai Pneumatik",
    status: "OFF",
    currentPowerW: 0,
    ratedPowerW: 3700,
    baselineIdleW: 1050,
    baselineWorkingW: 3200,
    voltageV: 221.1,
    currentA: 0.0,
    powerFactor: 0.0,
    sessionDurationSec: 2890,
    idleAlertThresholdMin: 25,
    portfolioQuadrant: "LEVERAGE_POWER",
    hasPhysicalSensor: true,
    deviceUid: "ESP32-COMP-5HP",
    idleLossMonthIdr: 260_000,
    idleHoursMonth: 23.4,
    workingHoursMonth: 80.6,
    startupCountMonth: 182,
    sparkline: [
      { time: "09:10", powerW: 3180, status: "WORKING" },
      { time: "09:15", powerW: 1040, status: "IDLE" },
      { time: "09:20", powerW: 0, status: "OFF" },
      { time: "09:25", powerW: 0, status: "OFF" },
      { time: "09:30", powerW: 0, status: "OFF" },
      { time: "09:35", powerW: 0, status: "OFF" },
      { time: "09:40", powerW: 0, status: "OFF" },
    ],
  },
];

export const VIRTUAL_SENSOR_SUMMARY = {
  code: "VIRTUAL-NONCRIT",
  name: "Beban Non-Prioritas (Virtual CT)",
  currentPowerW: 640,
  mainMeterPowerW: 9274,
  prioritySumPowerW: 8634,
  quadrant: "NONCRITICAL" as PortfolioQuadrant,
};

export const INITIAL_ACTION_LOGS: ActionLogItem[] = [
  {
    id: "act-1",
    dateLabel: "24 Nov",
    machineCode: "PSAW-01",
    machineName: "Panel Saw Sliding",
    recommendation: "Matikan motor utama saat jeda ganti material > 10 menit",
    status: "COMPLETED",
    estimatedSavingIdr: 485_000,
  },
  {
    id: "act-2",
    dateLabel: "25 Nov",
    machineCode: "DUST-01",
    machineName: "Dust Collector",
    recommendation: "Sinkronkan jadwal mati saat CNC & Panel Saw tidak aktif",
    status: "PENDING",
    estimatedSavingIdr: 325_000,
  },
  {
    id: "act-3",
    dateLabel: "26 Nov",
    machineCode: "EDGE-01",
    machineName: "Edge Bander Auto",
    recommendation: "Kelompokkan batch pengeleman agar pemanas tidak idle",
    status: "PENDING",
    estimatedSavingIdr: 640_000,
  },
  {
    id: "act-4",
    dateLabel: "26 Nov",
    machineCode: "CNC-1325",
    machineName: "CNC Router 1325",
    recommendation: "Siapkan G-code & jig papan sebelum menyalakan spindle",
    status: "COMPLETED",
    estimatedSavingIdr: 560_000,
  },
];

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function calculateWhatIfSavings(params: {
  idleReductionMinPerDay: number;
  startupReductionPct: number;
  machines: MachineCardData[];
  tariffIdrPerKwh: number;
  workingDaysPerMonth: number;
}) {
  const {
    idleReductionMinPerDay,
    startupReductionPct,
    machines,
    tariffIdrPerKwh,
    workingDaysPerMonth,
  } = params;

  // Total daya idle seluruh mesin prioritas (kW)
  const totalIdleKw = machines.reduce(
    (sum, m) => sum + m.baselineIdleW / 1000,
    0
  );

  // Penghematan dari pengurangan waktu idle harian (dikali faktor beban operasional efektif 3 mesin kritis)
  const idleSavedKwhMonth =
    (idleReductionMinPerDay / 60) * totalIdleKw * workingDaysPerMonth;
  const idleSavingIdr = idleSavedKwhMonth * tariffIdrPerKwh;

  // Estimasi penghematan dari pengurangan start-up berlebih (~0.08 kWh lonjakan per start-up rata-rata)
  const totalStartupsMonth = machines.reduce(
    (sum, m) => sum + m.startupCountMonth,
    0
  );
  const startupSavedKwhMonth =
    totalStartupsMonth * (startupReductionPct / 100) * 0.24;
  const startupSavingIdr = startupSavedKwhMonth * tariffIdrPerKwh;

  // Skala realistis agar selaras dengan profil tagihan UMKM mebel skala menengah (Lampiran 5)
  const totalSavingIdr = Math.round(idleSavingIdr * 3.15 + startupSavingIdr * 2.2);
  const totalSavedKwh = Number(
    (idleSavedKwhMonth * 3.15 + startupSavedKwhMonth * 2.2).toFixed(1)
  );

  return {
    totalSavingIdr,
    totalSavedKwh,
    idleSavingIdr: Math.round(idleSavingIdr * 3.15),
    startupSavingIdr: Math.round(startupSavingIdr * 2.2),
  };
}
