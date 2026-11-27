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
  title: "WattWise — Energy Intelligence",
  description:
    "Platform audit energi pintar dan pemantauan mesin real-time berbasis IoT, Machine Learning ISO 14955-5, dan AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
