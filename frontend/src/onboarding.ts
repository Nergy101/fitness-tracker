// First-run onboarding flag, shared across the app via a tiny observable
// store (same pattern as locale.ts) so App and the settings modal react
// together when it changes.

const STORAGE_KEY = "onboardingComplete";

let current: boolean =
  typeof localStorage !== "undefined" &&
  localStorage.getItem(STORAGE_KEY) === "1";

const listeners = new Set<() => void>();

export function getOnboardingComplete(): boolean {
  return current;
}

export function setOnboardingComplete(value: boolean): void {
  if (value === current) return;
  current = value;
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
  listeners.forEach((l) => l());
}

export function subscribeOnboarding(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
