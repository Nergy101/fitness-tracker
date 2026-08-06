import { afterEach, describe, expect, it, vi } from "vitest";
import type { InstallPromptState } from "../installPrompt";

type Store = typeof import("../installPrompt");

// Load a fresh module instance per test so the module-level state resets.
async function loadStore(): Promise<Store> {
  vi.resetModules();
  return await import("../installPrompt");
}

function makeBeforeInstallPromptEvent(outcome: "accepted" | "dismissed" = "accepted"): Event {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return event;
}

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("installPrompt store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts with no install UI needed", async () => {
    const store = await loadStore();

    expect(store.getInstallPromptState()).toEqual<InstallPromptState>({
      installable: false,
      standalone: false,
      iosSafari: false,
    });
  });

  it("captures beforeinstallprompt and becomes installable", async () => {
    const store = await loadStore();

    window.dispatchEvent(makeBeforeInstallPromptEvent());

    expect(store.getInstallPromptState().installable).toBe(true);
  });

  it("promptInstall() prompts, resolves the outcome and clears installable", async () => {
    const store = await loadStore();
    const event = makeBeforeInstallPromptEvent("accepted");
    const prompt = (event as unknown as { prompt: () => void }).prompt;
    window.dispatchEvent(event);

    const outcome = await store.promptInstall();

    expect(outcome).toBe("accepted");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(store.getInstallPromptState().installable).toBe(false);
  });

  it("hides installable after appinstalled", async () => {
    const store = await loadStore();
    window.dispatchEvent(makeBeforeInstallPromptEvent());
    expect(store.getInstallPromptState().installable).toBe(true);

    window.dispatchEvent(new Event("appinstalled"));

    expect(store.getInstallPromptState().installable).toBe(false);
  });

  it("detects iOS Safari for the Add to Home Screen hint", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IOS_SAFARI_UA);
    const store = await loadStore();

    const state = store.getInstallPromptState();
    expect(state.iosSafari).toBe(true);
    expect(state.installable).toBe(false);
  });

  it("reports standalone when running as an installed app", async () => {
    // jsdom has no window.matchMedia; stub it to simulate standalone mode.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true } as unknown as MediaQueryList),
    );
    const store = await loadStore();

    const state = store.getInstallPromptState();
    expect(state.standalone).toBe(true);
    expect(state.installable).toBe(false);
    expect(state.iosSafari).toBe(false);
  });
});
