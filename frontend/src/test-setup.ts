import "@testing-library/jest-dom/vitest";

// Node 26 defines an experimental global `localStorage` (only usable with
// `--localstorage-file`) that shadows jsdom's implementation during vitest's
// global population, leaving `window.localStorage` and bare `localStorage`
// undefined. Tests referencing `localStorage` (auth, locale, onboarding,
// HistoryTab) then crash. Install a working in-memory Storage on both `window`
// and `globalThis` so those tests see a functional storage regardless.
const store = new Map<string, string>();
const localStorageShim = {
  get length() {
    return store.size;
  },
  clear: () => {
    store.clear();
  },
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  removeItem: (k: string) => {
    store.delete(k);
  },
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
} as Storage;

for (const target of [globalThis, typeof window !== "undefined" ? window : null]) {
  if (target) {
    try {
      Object.defineProperty(target, "localStorage", {
        value: localStorageShim,
        configurable: true,
        writable: true,
      });
    } catch {
      // property not definable on this target — skip
    }
  }
}
