import { useEffect, useState } from "react";

/** The id encoded in the current location hash, e.g. "#stats" → "stats". */
function fromHash(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

/**
 * Tab state synced with the URL hash so a refresh (or a shared link) lands on
 * the same tab and the browser's back/forward buttons move between tabs.
 *
 * - `#stats` → "stats"; unknown or empty hashes fall back to `fallback` and
 *   the URL is normalized via replaceState (no junk history entry).
 * - Setting a tab assigns `location.hash`, which pushes a history entry —
 *   on mobile PWAs the system back gesture then returns to the previous tab.
 */
export function useHashRoute<T extends string>(
  valid: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const isValid = (v: string): v is T => (valid as readonly string[]).includes(v);

  const [route, setRoute] = useState<T>(() => {
    const h = fromHash();
    return isValid(h) ? h : fallback;
  });

  useEffect(() => {
    const onHashChange = () => {
      const h = fromHash();
      if (isValid(h)) {
        setRoute(h);
      } else {
        // Normalize bad/empty hashes without adding a history entry.
        window.history.replaceState(null, "", `#${fallback}`);
        setRoute(fallback);
      }
    };
    // Normalize the initial URL too (e.g. first visit with no hash).
    if (!isValid(fromHash())) {
      window.history.replaceState(null, "", `#${fallback}`);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (next: T) => {
    if (next === route) return;
    // Assigning the hash fires hashchange, which updates the state — a single
    // source of truth, so external hash edits behave identically.
    window.location.hash = next;
  };

  return [route, navigate];
}
