"use client";

import * as React from "react";
import { SkulletProvider } from "skullet/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SkulletProvider
      mode="dark"
      reveal="smart"
      theme={{
        dark: {
          base: "#172030",
          highlight: "#24324a",
        },
      }}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </SkulletProvider>
  );
}
