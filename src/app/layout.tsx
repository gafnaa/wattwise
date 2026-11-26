import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "WattWise — Smart Energy Audit System",
  description:
    "Sistem Audit Energi Pintar Berbasis IoT untuk Pemantauan Status Mesin dan Efisiensi Daya pada UMKM Mebel Skala Menengah",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-orange-500/30 selection:text-orange-100">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
