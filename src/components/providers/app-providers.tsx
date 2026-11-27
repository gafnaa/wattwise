"use client";

import * as React from "react";
import { SkulletProvider } from "skullet/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

const THEME_STORAGE_KEY = "wattwise-theme";
const THEME_EVENT = "wattwise-theme-change";

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemeSnapshot(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getThemeServerSnapshot(): ThemeMode {
  return "light";
}

export function useWattWiseTheme() {
  return React.useContext(ThemeContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = React.useCallback((next: ThemeMode) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Abaikan bila storage terbatas
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <SkulletProvider
        mode={theme}
        reveal="smart"
        theme={{
          light: {
            base: "#f4f4f5",
            highlight: "#e4e4e7",
          },
          dark: {
            base: "#18181b",
            highlight: "#27272a",
          },
        }}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </SkulletProvider>
    </ThemeContext.Provider>
  );
}
