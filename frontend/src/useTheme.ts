import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";
const THEME_COLOR: Record<Theme, string> = {
  light: "#f4f4f6",
  dark: "#1e1e2e",
};

// ─── Module store ──────────────────────────────────────────
// Shared by every useTheme() instance (same pattern as locale.ts) so the app
// shell, the settings modal, and the workout runner all see one mode and
// update together.

function initialMode(): ThemeMode {
  const stored =
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

let currentMode: ThemeMode = initialMode();
const listeners = new Set<() => void>();

function subscribeMode(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function setMode(value: ThemeMode): void {
  if (value === currentMode) return;
  currentMode = value;
  listeners.forEach((fn) => fn());
}

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

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

function resolveTheme(mode: ThemeMode, systemDark: boolean): Theme {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

export interface ThemeControls {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

export function useTheme(): ThemeControls {
  const systemDark = useSystemDark();
  const mode = useSyncExternalStore(
    subscribeMode,
    () => currentMode,
    () => currentMode,
  );
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
    setMode,
    cycleMode: () => setMode(CYCLE[(CYCLE.indexOf(currentMode) + 1) % CYCLE.length]),
  };
}
