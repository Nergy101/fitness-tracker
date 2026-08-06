import { useEffect } from "react";

/**
 * Keeps the screen awake while `active` is true using the Screen Wake Lock API
 * (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
 *
 * Browsers auto-release the lock when the tab is hidden, so it is re-acquired
 * on visibilitychange. Unsupported browsers and rejected requests (screen off,
 * low-power mode) fail silently — a workout must never crash because the lock
 * could not be taken.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    async function acquire(): Promise<void> {
      if (disposed) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // NotAllowedError (screen off, low power mode) or unsupported — no-op.
      }
    }

    void acquire();

    function onVisibilityChange(): void {
      if (document.visibilityState === "visible" && !lock) {
        void acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (lock) {
        void lock.release().catch(() => {});
        lock = null;
      }
    };
  }, [active]);
}
