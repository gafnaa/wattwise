import type { Metadata } from "next";
import { ActionsPageClient } from "@/components/actions/actions-page-client";

export const metadata: Metadata = {
  title: "Hemat & Aksi — WattWise",
  description: "Simulator penghematan energi dan daftar tindakan efisiensi.",
};

export default function ActionsPage() {
  return <ActionsPageClient />;
}
