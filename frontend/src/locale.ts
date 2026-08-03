// User-selectable date locale (day/month order), shared across the app via a
// tiny observable store so every consumer re-renders together on change.

export type DateLocale = "dmy" | "mdy";

const STORAGE_KEY = "dateLocale";

function initial(): DateLocale {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return v === "mdy" ? "mdy" : "dmy";
}

let current: DateLocale = initial();
const listeners = new Set<() => void>();

export function getDateLocale(): DateLocale {
  return current;
}

export function setDateLocale(value: DateLocale): void {
  if (value === current) return;
  current = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage failures
  }
  listeners.forEach((l) => l());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Short day/month label, e.g. "28/6" (dmy) or "6/28" (mdy). */
export function shortDate(d: Date, locale: DateLocale = current): string {
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return locale === "mdy" ? `${month}/${day}` : `${day}/${month}`;
}

/** Chart x-axis label for a week-start ISO date ("2026-07-14") or an
 *  already-short day label ("M"). ISO dates become locale-aware short labels
 *  ("14/7" dmy, "7/14" mdy); anything else passes through unchanged. */
export function formatWeekLabel(value: string, locale: DateLocale = current): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return shortDate(new Date(value + "T12:00:00"), locale);
  }
  return value;
}
