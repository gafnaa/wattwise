import type { Metadata } from "next";
import { MachinesPageClient } from "@/components/machines/machines-page-client";

export const metadata: Metadata = {
  title: "Mesin — WattWise",
  description: "Pemantauan status dan daya mesin mebel secara real-time.",
};

export default function MachinesPage() {
  return <MachinesPageClient />;
}
