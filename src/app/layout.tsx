import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "skullet/styles.css";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WattWise — Audit Energi Pintar",
  description: "Pemantauan status mesin dan efisiensi daya UMKM mebel.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-orange-500/30 selection:text-orange-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
