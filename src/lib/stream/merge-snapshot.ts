import type { MachineCardData, MachineStatus } from "@/lib/mock-dashboard-data";

export interface StreamMachineSnapshot {
  id: string;
  code: string;
  name?: string;
  status: MachineStatus;
  currentPowerW: number;
  currentA?: number;
  powerFactor?: number;
  sessionDurationSec?: number;
}

/**
 * Menggabungkan payload parsial dari SSE `event: snapshot` (`/api/stream`)
 * ke state `MachineCardData[]` di client tanpa menghilangkan metadata mesin
 * seperti `ratedPowerW`, `categoryLabel`, `workingHoursMonth`, atau `sparkline`.
 */
export function mergeStreamSnapshotIntoMachines(
  currentMachines: readonly MachineCardData[],
  incomingSnapshots: readonly StreamMachineSnapshot[]
): MachineCardData[] {
  if (!incomingSnapshots.length) {
    return [...currentMachines];
  }

  const byId = new Map<string, StreamMachineSnapshot>();
  const byCode = new Map<string, StreamMachineSnapshot>();
  for (const snap of incomingSnapshots) {
    if (snap.id) byId.set(snap.id, snap);
    if (snap.code) byCode.set(snap.code.toUpperCase(), snap);
  }

  return currentMachines.map((machine) => {
    const snap =
      byId.get(machine.id) ?? byCode.get(machine.code.toUpperCase());
    if (!snap) return machine;

    return {
      ...machine,
      status: snap.status ?? machine.status,
      currentPowerW:
        typeof snap.currentPowerW === "number" &&
        Number.isFinite(snap.currentPowerW)
          ? snap.currentPowerW
          : machine.currentPowerW,
      currentA:
        typeof snap.currentA === "number" && Number.isFinite(snap.currentA)
          ? snap.currentA
          : machine.currentA,
      powerFactor:
        typeof snap.powerFactor === "number" &&
        Number.isFinite(snap.powerFactor)
          ? snap.powerFactor
          : machine.powerFactor,
      sessionDurationSec:
        typeof snap.sessionDurationSec === "number" &&
        Number.isFinite(snap.sessionDurationSec)
          ? snap.sessionDurationSec
          : machine.sessionDurationSec,
    };
  });
}
