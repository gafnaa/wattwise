import type { PortfolioQuadrant } from "@/lib/mock-dashboard-data";

/**
 * Klasifikasi otomatis Matrix Energy Portfolio (Thiede et al., 2013 — Lampiran 1 Proposal):
 * - Kuadran II  (CRITICAL)       : Daya >= avgPowerW && Jam Operasi >= avgHoursPerYear -> Wajib Sensor Fisik
 * - Kuadran I   (LEVERAGE_POWER) : Daya >= avgPowerW && Jam Operasi <  avgHoursPerYear -> Prioritas Selektif
 * - Kuadran III (LEVERAGE_TIME)  : Daya <  avgPowerW && Jam Operasi >= avgHoursPerYear -> Prioritas Selektif
 * - Kuadran IV  (NONCRITICAL)    : Daya <  avgPowerW && Jam Operasi <  avgHoursPerYear -> Virtual Sensor (CT)
 */
export function classifyEnergyPortfolioQuadrant(params: {
  ratedPowerW: number;
  annualOperatingHours: number;
  avgPowerThresholdW?: number;
  avgOperatingHoursThreshold?: number;
}): {
  quadrant: PortfolioQuadrant;
  recommendedPhysicalSensor: boolean;
  label: string;
  description: string;
} {
  const {
    ratedPowerW,
    annualOperatingHours,
    avgPowerThresholdW = 3000,
    avgOperatingHoursThreshold = 1600,
  } = params;

  const highPower = ratedPowerW >= avgPowerThresholdW;
  const highTime = annualOperatingHours >= avgOperatingHoursThreshold;

  if (highPower && highTime) {
    return {
      quadrant: "CRITICAL",
      recommendedPhysicalSensor: true,
      label: "Kuadran II — Critical Machine",
      description:
        "Daya tinggi & jam operasi panjang. Wajib dipasang node sensor fisik ESP32 + PZEM-004T.",
    };
  }
  if (highPower && !highTime) {
    return {
      quadrant: "LEVERAGE_POWER",
      recommendedPhysicalSensor: true,
      label: "Kuadran I — Leverage Power Demand",
      description:
        "Daya nominal tinggi dengan jam operasi lebih singkat. Disarankan dipasang sensor prioritas.",
    };
  }
  if (!highPower && highTime) {
    return {
      quadrant: "LEVERAGE_TIME",
      recommendedPhysicalSensor: true,
      label: "Kuadran III — Leverage Operating Time",
      description:
        "Daya menengah/rendah namun menyala hampir sepanjang shift. Pantau durasi idle.",
    };
  }

  return {
    quadrant: "NONCRITICAL",
    recommendedPhysicalSensor: false,
    label: "Kuadran IV — Noncritical",
    description:
      "Daya rendah & jam operasi singkat. Cukup diestimasi secara agregat via Virtual Sensor.",
  };
}
