import { useEffect, useState, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";
const THEME_COLOR: Record<Theme, string> = {
  light: "#f4f4f6",
  dark: "#1e1e2e",
};

/** True when system prefers dark. Uses useSyncExternalStore so React
 *  subscribes to live changes without a re-render storm. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

function getStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function resolveTheme(mode: ThemeMode, systemDark: boolean): Theme {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

export interface ThemeControls {
  theme: Theme;
  mode: ThemeMode;
  cycleMode: () => void;
}

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

export function useTheme(): ThemeControls {
  const systemDark = useSystemDark();
  const [mode, setMode] = useState<ThemeMode>(getStoredMode);
  const theme = resolveTheme(mode, systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  }, [theme, mode]);

  return {
    theme,
    mode,
    cycleMode: () =>
      setMode((prev) => {
        const idx = CYCLE.indexOf(prev);
        return CYCLE[(idx + 1) % CYCLE.length];
      }),
  };
}