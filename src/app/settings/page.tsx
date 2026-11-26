import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Pengaturan & Manajemen Mesin — WattWise",
  description:
    "Atur tarif listrik PLN (Rp/kWh), pemetaan kuadran Matrix Energy Portfolio, threshold idle mesin, dan konfigurasi WattWise Telegram Bot.",
};

export default function SettingsPage() {
  return <SettingsShell />;
}
