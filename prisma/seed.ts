import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  DeliveryStatus,
  MachineStatus,
  MachineType,
  NotificationType,
  PortfolioQuadrant,
  PrismaClient,
  RecommendationSource,
  RecommendationStatus,
  UserRole,
} from "../src/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://wattwise:wattwise_dev@localhost:5432/wattwise?schema=public";

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// PRNG deterministik agar data baseline selalu konsisten tiap kali seed dijalankan
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

interface MachineSeedSpec {
  code: string;
  name: string;
  machineType: MachineType;
  ratedPowerW: number;
  annualOperatingHours: number;
  portfolioQuadrant: PortfolioQuadrant;
  hasPhysicalSensor: boolean;
  idleAlertThresholdMin: number;
  baselineIdleW: number;
  baselineWorkingW: number;
  deviceUid?: string;
  demoApiKey?: string;
  currentLiveStatus: MachineStatus;
  avgIdleHoursPerDay: number;
  avgWorkingHoursPerDay: number;
  startupsPerDay: number;
}

const MACHINE_SPECS: MachineSeedSpec[] = [
  {
    code: "CNC-1325",
    name: "CNC Router 1325",
    machineType: MachineType.CNC,
    ratedPowerW: 5500,
    annualOperatingHours: 2400,
    portfolioQuadrant: PortfolioQuadrant.CRITICAL,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 15,
    baselineIdleW: 1650,
    baselineWorkingW: 4450,
    deviceUid: "ESP32-CNC-1325",
    demoApiKey: "ww_dev_cnc_1325_demo",
    currentLiveStatus: MachineStatus.WORKING,
    avgIdleHoursPerDay: 1.8,
    avgWorkingHoursPerDay: 5.4,
    startupsPerDay: 4,
  },
  {
    code: "EDGE-01",
    name: "Edge Bander Auto",
    machineType: MachineType.EDGE_BANDER,
    ratedPowerW: 4200,
    annualOperatingHours: 2100,
    portfolioQuadrant: PortfolioQuadrant.CRITICAL,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 15,
    baselineIdleW: 1480,
    baselineWorkingW: 3350,
    deviceUid: "ESP32-EDGE-01",
    demoApiKey: "ww_dev_edge_01_demo",
    currentLiveStatus: MachineStatus.IDLE,
    avgIdleHoursPerDay: 2.3,
    avgWorkingHoursPerDay: 4.3,
    startupsPerDay: 5,
  },
  {
    code: "PSAW-01",
    name: "Panel Saw Sliding",
    machineType: MachineType.PANEL_SAW,
    ratedPowerW: 3800,
    annualOperatingHours: 2050,
    portfolioQuadrant: PortfolioQuadrant.CRITICAL,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 15,
    baselineIdleW: 1320,
    baselineWorkingW: 3150,
    deviceUid: "ESP32-PSAW-01",
    demoApiKey: "ww_dev_psaw_01_demo",
    currentLiveStatus: MachineStatus.IDLE,
    avgIdleHoursPerDay: 2.6,
    avgWorkingHoursPerDay: 4.1,
    startupsPerDay: 6,
  },
  {
    code: "DUST-01",
    name: "Dust Collector",
    machineType: MachineType.DUST_COLLECTOR,
    ratedPowerW: 2200,
    annualOperatingHours: 2200,
    portfolioQuadrant: PortfolioQuadrant.LEVERAGE_TIME,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 20,
    baselineIdleW: 920,
    baselineWorkingW: 1850,
    deviceUid: "ESP32-DUST-01",
    demoApiKey: "ww_dev_dust_01_demo",
    currentLiveStatus: MachineStatus.OFF,
    avgIdleHoursPerDay: 1.5,
    avgWorkingHoursPerDay: 4.8,
    startupsPerDay: 4,
  },
  {
    code: "BOR-01",
    name: "Mesin Bor (Boring)",
    machineType: MachineType.BORING,
    ratedPowerW: 1800,
    annualOperatingHours: 1150,
    portfolioQuadrant: PortfolioQuadrant.LEVERAGE_POWER,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 20,
    baselineIdleW: 480,
    baselineWorkingW: 1420,
    deviceUid: "ESP32-BOR-01",
    demoApiKey: "ww_dev_bor_01_demo",
    currentLiveStatus: MachineStatus.WORKING,
    avgIdleHoursPerDay: 1.1,
    avgWorkingHoursPerDay: 3.4,
    startupsPerDay: 5,
  },
  {
    code: "COMP-5HP",
    name: "Kompresor 5HP",
    machineType: MachineType.COMPRESSOR,
    ratedPowerW: 3700,
    annualOperatingHours: 1400,
    portfolioQuadrant: PortfolioQuadrant.LEVERAGE_POWER,
    hasPhysicalSensor: true,
    idleAlertThresholdMin: 25,
    baselineIdleW: 1050,
    baselineWorkingW: 3200,
    deviceUid: "ESP32-COMP-5HP",
    demoApiKey: "ww_dev_comp_5hp_demo",
    currentLiveStatus: MachineStatus.OFF,
    avgIdleHoursPerDay: 0.9,
    avgWorkingHoursPerDay: 3.1,
    startupsPerDay: 7,
  },
  {
    code: "VIRTUAL-NONCRIT",
    name: "Beban Non-Prioritas (Virtual CT)",
    machineType: MachineType.VIRTUAL_AGGREGATE,
    ratedPowerW: 1500,
    annualOperatingHours: 800,
    portfolioQuadrant: PortfolioQuadrant.NONCRITICAL,
    hasPhysicalSensor: false,
    idleAlertThresholdMin: 30,
    baselineIdleW: 340,
    baselineWorkingW: 980,
    currentLiveStatus: MachineStatus.WORKING,
    avgIdleHoursPerDay: 1.0,
    avgWorkingHoursPerDay: 3.0,
    startupsPerDay: 2,
  },
];

async function main() {
  const rng = createRng(20261204);
  const now = new Date();
  const tariffIdr = 1444.7;

  console.log("Seeding WattWise database...");

  // 1. Workshop pilot (Sentra Mebel Sukoharjo)
  const workshop = await prisma.workshop.upsert({
    where: { code: "WS-SKH-01" },
    update: {
      name: "Area Produksi Furnitur — Sukoharjo",
      location: "Sentra Mebel Trangsan, Kab. Sukoharjo, Jawa Tengah",
      tariffIdrPerKwh: tariffIdr,
      workingDaysPerMonth: 26,
    },
    create: {
      code: "WS-SKH-01",
      name: "Area Produksi Furnitur — Sukoharjo",
      location: "Sentra Mebel Trangsan, Kab. Sukoharjo, Jawa Tengah",
      tariffIdrPerKwh: tariffIdr,
      workingDaysPerMonth: 26,
      telegramChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || null,
    },
  });

  // 2. Users (Pemilik & Teknisi)
  const ownerPasswordHash = await bcrypt.hash("wattwise123", 10);
  const techPasswordHash = await bcrypt.hash("teknisi123", 10);

  await prisma.user.upsert({
    where: { username: "owner" },
    update: {
      fullName: "Pemilik Pabrik",
      role: UserRole.OWNER,
      workshopId: workshop.id,
    },
    create: {
      workshopId: workshop.id,
      username: "owner",
      passwordHash: ownerPasswordHash,
      fullName: "Pemilik Pabrik",
      role: UserRole.OWNER,
    },
  });

  await prisma.user.upsert({
    where: { username: "teknisi" },
    update: {
      fullName: "Teknisi Bengkel",
      role: UserRole.TECHNICIAN,
      workshopId: workshop.id,
    },
    create: {
      workshopId: workshop.id,
      username: "teknisi",
      passwordHash: techPasswordHash,
      fullName: "Teknisi Bengkel",
      role: UserRole.TECHNICIAN,
    },
  });

  // 3. Node Meter Induk PLN
  await prisma.device.upsert({
    where: { deviceUid: "ESP32-MAIN-01" },
    update: {
      lastSeenAt: now,
      isMainMeter: true,
      firmwareVersion: "1.0.0",
    },
    create: {
      workshopId: workshop.id,
      deviceUid: "ESP32-MAIN-01",
      apiKeyHash: hashApiKey("ww_dev_main_meter_demo"),
      isMainMeter: true,
      firmwareVersion: "1.0.0",
      lastSeenAt: now,
    },
  });

  // 4. Machines & ESP32 Devices
  const machineMap = new Map<
    string,
    { id: string; deviceId: string | null; spec: MachineSeedSpec }
  >();

  for (const spec of MACHINE_SPECS) {
    const machine = await prisma.machine.upsert({
      where: {
        workshopId_code: {
          workshopId: workshop.id,
          code: spec.code,
        },
      },
      update: {
        name: spec.name,
        machineType: spec.machineType,
        ratedPowerW: spec.ratedPowerW,
        annualOperatingHours: spec.annualOperatingHours,
        portfolioQuadrant: spec.portfolioQuadrant,
        hasPhysicalSensor: spec.hasPhysicalSensor,
        idleAlertThresholdMin: spec.idleAlertThresholdMin,
        baselineIdleW: spec.baselineIdleW,
        baselineWorkingW: spec.baselineWorkingW,
        isActive: true,
      },
      create: {
        workshopId: workshop.id,
        code: spec.code,
        name: spec.name,
        machineType: spec.machineType,
        ratedPowerW: spec.ratedPowerW,
        annualOperatingHours: spec.annualOperatingHours,
        portfolioQuadrant: spec.portfolioQuadrant,
        hasPhysicalSensor: spec.hasPhysicalSensor,
        idleAlertThresholdMin: spec.idleAlertThresholdMin,
        baselineIdleW: spec.baselineIdleW,
        baselineWorkingW: spec.baselineWorkingW,
        isActive: true,
      },
    });

    let deviceId: string | null = null;
    if (spec.hasPhysicalSensor && spec.deviceUid && spec.demoApiKey) {
      const device = await prisma.device.upsert({
        where: { deviceUid: spec.deviceUid },
        update: {
          machineId: machine.id,
          lastSeenAt: now,
          firmwareVersion: "1.0.0",
        },
        create: {
          workshopId: workshop.id,
          machineId: machine.id,
          deviceUid: spec.deviceUid,
          apiKeyHash: hashApiKey(spec.demoApiKey),
          isMainMeter: false,
          firmwareVersion: "1.0.0",
          lastSeenAt: now,
        },
      });
      deviceId = device.id;
    }

    machineMap.set(spec.code, { id: machine.id, deviceId, spec });
  }

  // Bersihkan data simulasi lama agar re-seeding tetap idempotent & bersih
  const machineIds = Array.from(machineMap.values()).map((m) => m.id);
  await prisma.telemetryReading.deleteMany({
    where: { machineId: { in: machineIds }, isSimulated: true },
  });
  await prisma.machineStateSession.deleteMany({
    where: { machineId: { in: machineIds } },
  });
  await prisma.productionLog.deleteMany({ where: { workshopId: workshop.id } });
  await prisma.actionRecommendation.deleteMany({
    where: { workshopId: workshop.id },
  });
  await prisma.telegramNotification.deleteMany({
    where: { workshopId: workshop.id },
  });

  // 5. Riwayat Baseline 14 Hari Kerja (MachineStateSession)
  const sessionsToInsert: Array<{
    machineId: string;
    status: MachineStatus;
    startedAt: Date;
    endedAt: Date | null;
    durationSec: number;
    avgPowerW: number;
    energyKwh: number;
    costIdr: number;
  }> = [];

  const DAYS = 14;
  for (let dayOffset = DAYS; dayOffset >= 1; dayOffset--) {
    const dayBase = new Date(now);
    dayBase.setHours(8, 0, 0, 0);
    dayBase.setDate(dayBase.getDate() - dayOffset);

    // Lewati hari Minggu agar realistis mengikuti jadwal bengkel mebel
    if (dayBase.getDay() === 0) continue;

    for (const { id: machineId, spec } of machineMap.values()) {
      let cursorMs = dayBase.getTime();

      // Sesi START_UP harian (akumulasi per blok shift)
      const startupDurationSec = spec.startupsPerDay * 25;
      const startupAvgW = spec.ratedPowerW * (1.12 + rng() * 0.12);
      const startupKwh = (startupAvgW * startupDurationSec) / 3_600_000;
      sessionsToInsert.push({
        machineId,
        status: MachineStatus.START_UP,
        startedAt: new Date(cursorMs),
        endedAt: new Date(cursorMs + startupDurationSec * 1000),
        durationSec: startupDurationSec,
        avgPowerW: Number(startupAvgW.toFixed(1)),
        energyKwh: Number(startupKwh.toFixed(4)),
        costIdr: Number((startupKwh * tariffIdr).toFixed(2)),
      });
      cursorMs += startupDurationSec * 1000;

      // Sesi WORKING (dibagi 2 blok: pagi & siang)
      const totalWorkSec = Math.round(
        spec.avgWorkingHoursPerDay * 3600 * (0.88 + rng() * 0.24)
      );
      const morningWorkSec = Math.round(totalWorkSec * 0.55);
      const afternoonWorkSec = totalWorkSec - morningWorkSec;

      const morningWorkW = spec.baselineWorkingW * (0.94 + rng() * 0.12);
      const morningWorkKwh = (morningWorkW * morningWorkSec) / 3_600_000;
      sessionsToInsert.push({
        machineId,
        status: MachineStatus.WORKING,
        startedAt: new Date(cursorMs),
        endedAt: new Date(cursorMs + morningWorkSec * 1000),
        durationSec: morningWorkSec,
        avgPowerW: Number(morningWorkW.toFixed(1)),
        energyKwh: Number(morningWorkKwh.toFixed(4)),
        costIdr: Number((morningWorkKwh * tariffIdr).toFixed(2)),
      });
      cursorMs += morningWorkSec * 1000;

      // Sesi IDLE (jeda persiapan kayu & istirahat tanpa mematikan mesin)
      const totalIdleSec = Math.round(
        spec.avgIdleHoursPerDay * 3600 * (0.85 + rng() * 0.3)
      );
      const idleAvgW = spec.baselineIdleW * (0.95 + rng() * 0.1);
      const idleKwh = (idleAvgW * totalIdleSec) / 3_600_000;
      sessionsToInsert.push({
        machineId,
        status: MachineStatus.IDLE,
        startedAt: new Date(cursorMs),
        endedAt: new Date(cursorMs + totalIdleSec * 1000),
        durationSec: totalIdleSec,
        avgPowerW: Number(idleAvgW.toFixed(1)),
        energyKwh: Number(idleKwh.toFixed(4)),
        costIdr: Number((idleKwh * tariffIdr).toFixed(2)),
      });
      cursorMs += totalIdleSec * 1000;

      // Blok WORKING siang
      const afternoonWorkW = spec.baselineWorkingW * (0.92 + rng() * 0.14);
      const afternoonWorkKwh = (afternoonWorkW * afternoonWorkSec) / 3_600_000;
      sessionsToInsert.push({
        machineId,
        status: MachineStatus.WORKING,
        startedAt: new Date(cursorMs),
        endedAt: new Date(cursorMs + afternoonWorkSec * 1000),
        durationSec: afternoonWorkSec,
        avgPowerW: Number(afternoonWorkW.toFixed(1)),
        energyKwh: Number(afternoonWorkKwh.toFixed(4)),
        costIdr: Number((afternoonWorkKwh * tariffIdr).toFixed(2)),
      });
    }
  }

  // Sesi live yang sedang berlangsung hari ini (endedAt = null)
  for (const { id: machineId, spec } of machineMap.values()) {
    const activeDurationSec = 1800 + Math.round(rng() * 1800); // 30-60 menit berjalan
    const startedAt = new Date(now.getTime() - activeDurationSec * 1000);
    const livePowerW =
      spec.currentLiveStatus === MachineStatus.WORKING
        ? spec.baselineWorkingW
        : spec.currentLiveStatus === MachineStatus.IDLE
          ? spec.baselineIdleW
          : 4.5;
    const liveKwh = (livePowerW * activeDurationSec) / 3_600_000;

    sessionsToInsert.push({
      machineId,
      status: spec.currentLiveStatus,
      startedAt,
      endedAt: null,
      durationSec: activeDurationSec,
      avgPowerW: Number(livePowerW.toFixed(1)),
      energyKwh: Number(liveKwh.toFixed(4)),
      costIdr: Number((liveKwh * tariffIdr).toFixed(2)),
    });
  }

  await prisma.machineStateSession.createMany({ data: sessionsToInsert });

  // 6. Telemetry Readings (24 sampel terakhir tiap 5 detik per mesin untuk live chart)
  const telemetryToInsert: Array<{
    deviceId: string | null;
    machineId: string;
    sampleIndex: number;
    recordedAt: Date;
    powerW: number;
    voltageV: number | null;
    currentA: number | null;
    frequencyHz: number | null;
    powerFactor: number | null;
    predictedStatus: MachineStatus;
    statusConfidence: number;
    isSimulated: boolean;
  }> = [];

  for (const { id: machineId, deviceId, spec } of machineMap.values()) {
    for (let i = 24; i >= 1; i--) {
      const recordedAt = new Date(now.getTime() - i * 5000);
      const baseW =
        spec.currentLiveStatus === MachineStatus.WORKING
          ? spec.baselineWorkingW
          : spec.currentLiveStatus === MachineStatus.IDLE
            ? spec.baselineIdleW
            : 3.5;

      const jitter =
        spec.currentLiveStatus === MachineStatus.WORKING
          ? (rng() - 0.5) * 0.14
          : spec.currentLiveStatus === MachineStatus.IDLE
            ? (rng() - 0.5) * 0.03
            : (rng() - 0.5) * 0.1;

      const powerW = Math.max(0, Number((baseW * (1 + jitter)).toFixed(1)));
      const voltageV = Number((220.5 + (rng() - 0.5) * 3.0).toFixed(1));
      const powerFactor =
        spec.currentLiveStatus === MachineStatus.WORKING
          ? Number((0.86 + rng() * 0.08).toFixed(2))
          : spec.currentLiveStatus === MachineStatus.IDLE
            ? Number((0.52 + rng() * 0.08).toFixed(2))
            : 0.1;
      const currentA =
        voltageV > 0 && powerFactor > 0
          ? Number((powerW / (voltageV * powerFactor)).toFixed(2))
          : 0;

      telemetryToInsert.push({
        deviceId,
        machineId,
        sampleIndex: 25 - i,
        recordedAt,
        powerW,
        voltageV: spec.hasPhysicalSensor ? voltageV : null,
        currentA: spec.hasPhysicalSensor ? currentA : null,
        frequencyHz: spec.hasPhysicalSensor ? 50.0 : null,
        powerFactor: spec.hasPhysicalSensor ? powerFactor : null,
        predictedStatus: spec.currentLiveStatus,
        statusConfidence: Number((0.91 + rng() * 0.08).toFixed(3)),
        isSimulated: true,
      });
    }
  }

  await prisma.telemetryReading.createMany({ data: telemetryToInsert });

  // 7. Production Logs (untuk metrik kWh per produk sejenis)
  const productionLogs = [
    {
      workshopId: workshop.id,
      productCategory: "Meja Makan Kayu Jati",
      outputUnits: 18,
      periodDate: new Date(now.getTime() - 10 * 86400_000),
      notes: "Batch baseline minggu 1",
    },
    {
      workshopId: workshop.id,
      productCategory: "Lemari Pakaian 2 Pintu",
      outputUnits: 12,
      periodDate: new Date(now.getTime() - 6 * 86400_000),
      notes: "Batch baseline minggu 1-2",
    },
    {
      workshopId: workshop.id,
      productCategory: "Meja Makan Kayu Jati",
      outputUnits: 21,
      periodDate: new Date(now.getTime() - 2 * 86400_000),
      notes: "Batch baseline minggu 2",
    },
  ];
  await prisma.productionLog.createMany({ data: productionLogs });

  // 8. Action Recommendations (Log Tindakan Otomatisasi — Lampiran 5)
  const psawId = machineMap.get("PSAW-01")!.id;
  const dustId = machineMap.get("DUST-01")!.id;
  const edgeId = machineMap.get("EDGE-01")!.id;
  const cncId = machineMap.get("CNC-1325")!.id;

  await prisma.actionRecommendation.createMany({
    data: [
      {
        workshopId: workshop.id,
        machineId: psawId,
        recommendationText:
          "Matikan motor utama Panel Saw saat jeda ganti material > 10 menit",
        status: RecommendationStatus.COMPLETED,
        source: RecommendationSource.AI_RULE,
        estimatedSavingIdr: 485000,
        createdAt: new Date(now.getTime() - 5 * 86400_000),
        completedAt: new Date(now.getTime() - 4 * 86400_000),
      },
      {
        workshopId: workshop.id,
        machineId: dustId,
        recommendationText:
          "Sinkronkan jadwal mati Dust Collector saat CNC & Panel Saw tidak aktif",
        status: RecommendationStatus.PENDING,
        source: RecommendationSource.AI_RULE,
        estimatedSavingIdr: 325000,
        createdAt: new Date(now.getTime() - 3 * 86400_000),
      },
      {
        workshopId: workshop.id,
        machineId: edgeId,
        recommendationText:
          "Kelompokkan batch pengeleman Edge Bander agar pemanas tidak idle berkepanjangan",
        status: RecommendationStatus.PENDING,
        source: RecommendationSource.AI_RULE,
        estimatedSavingIdr: 640000,
        createdAt: new Date(now.getTime() - 2 * 86400_000),
      },
      {
        workshopId: workshop.id,
        machineId: cncId,
        recommendationText:
          "Siapkan desain G-code dan jig papan sebelum menyalakan spindle CNC Router",
        status: RecommendationStatus.COMPLETED,
        source: RecommendationSource.AI_RULE,
        estimatedSavingIdr: 560000,
        createdAt: new Date(now.getTime() - 1 * 86400_000),
        completedAt: now,
      },
    ],
  });

  // 9. Sample Telegram Notification Log
  await prisma.telegramNotification.create({
    data: {
      workshopId: workshop.id,
      machineId: edgeId,
      notificationType: NotificationType.DAILY_SUMMARY,
      messageBody:
        "⚡ Laporan Hemat Energi - Area Produksi Furnitur ⚡\nSistem mendeteksi potensi penghematan idle signifikan pada Edge Bander Auto & Panel Saw Sliding. Kurangi waktu idle 30 menit/hari untuk hemat biaya listrik bulanan.",
      deliveryStatus: DeliveryStatus.SENT,
      sentAt: new Date(now.getTime() - 3600_000),
    },
  });

  console.log(
    `Seed selesai: 1 workshop, 2 user, ${MACHINE_SPECS.length} mesin (6 sensor fisik + 1 virtual), ${sessionsToInsert.length} sesi status, ${telemetryToInsert.length} telemetri.`
  );
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
