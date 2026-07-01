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
