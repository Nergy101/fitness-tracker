/**
 * PWA install-prompt state.
 *
 * Captures the browser's `beforeinstallprompt` event (Chrome/Android/desktop)
 * so the UI can offer an explicit "Install app" action instead of relying on
 * the transient mini-infobar, and tracks `appinstalled` so the action hides
 * once the app is on the home screen. iOS Safari never fires the event —
 * callers use `iosSafari` to show an "Add to Home Screen" hint instead.
 *
 * Tiny observable store (same pattern as locale.ts): the snapshot object is
 * cached and rebuilt only on emit, so useSyncExternalStore consumers get a
 * stable reference between updates.
 */

export interface InstallPromptState {
  /** A captured beforeinstallprompt event that can still be prompted. */
  installable: boolean;
  /** Running as an installed standalone app (no install UI needed). */
  standalone: boolean;
  /** iOS Safari, not yet installed — install happens via Share → Add to Home Screen. */
  iosSafari: boolean;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const listeners = new Set<() => void>();

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

/**
 * Running as an installed app rather than in a browser tab.
 *
 * Two probes because neither alone covers iOS: `navigator.standalone` is the
 * only signal old iOS home-screen web apps expose, and the `display-mode`
 * query is the standard one every other engine (and modern WebKit) answers.
 * Exported because the layout keys on it too — see `.bottom-nav` in index.css.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) {
      return true;
    }
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches
    );
  } catch {
    return false;
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

function compute(): InstallPromptState {
  const standalone = isStandalone();
  return {
    installable: deferredPrompt !== null && !installed,
    standalone,
    iosSafari: isIosSafari() && !standalone,
  };
}

let snapshot: InstallPromptState = compute();

function emit(): void {
  snapshot = compute();
  listeners.forEach((l) => l());
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPromptState(): InstallPromptState {
  return snapshot;
}

/** Show the browser's install prompt for the captured event, if any. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const event = deferredPrompt;
  if (!event) return null;
  await event.prompt();
  const choice = await event.userChoice;
  deferredPrompt = null;
  if (choice.outcome === "accepted") installed = true;
  emit();
  return choice.outcome;
}

// Listen for the whole lifetime of the app, not just while Settings is open —
// the event fires once the PWA becomes installable, possibly long before the
// user opens the modal. In test/jsdom environments the events never fire and
// the listeners are harmless.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Suppress the default infobar; the Settings action is the prompt surface.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installed = false;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}
