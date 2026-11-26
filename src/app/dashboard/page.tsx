import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard Smart Audit — WattWise",
  description:
    "Pemantauan status mesin furnitur real-time, rasio ISO 14955-5, Pareto kerugian idle, dan simulator penghematan listrik WattWise.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
