import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useHashRoute } from "../useHashRoute";

const VALID = ["workout", "exercises", "history", "stats", "health"] as const;
type Route = (typeof VALID)[number];
const FALLBACK: Route = "workout";

beforeEach(() => {
  // Clear hash between tests; vi.restoreAllMocks cleans per-test replaceState spies.
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("useHashRoute", () => {
  describe("initial state from location.hash", () => {
    it("valid hash on load → reads that route as initial state", () => {
      window.location.hash = "#stats";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      expect(result.current[0]).toBe("stats");
    });

    it("#/ prefix is stripped and the route is resolved correctly", () => {
      window.location.hash = "#/exercises";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      expect(result.current[0]).toBe("exercises");
    });

    it("empty hash → fallback state and URL normalized via replaceState (no history entry)", () => {
      // hash is already "" from beforeEach — spy set before renderHook so the
      // effect's replaceState call is captured.
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");

      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));

      expect(result.current[0]).toBe(FALLBACK);
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", `#${FALLBACK}`);
    });

    it("unknown hash → fallback state and URL normalized via replaceState (no history entry)", () => {
      window.location.hash = "#not-a-real-tab";
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");

      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));

      expect(result.current[0]).toBe(FALLBACK);
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", `#${FALLBACK}`);
    });
  });

  describe("setter (navigate)", () => {
    it("navigate to a new route updates hash and state", async () => {
      window.location.hash = "#workout";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      expect(result.current[0]).toBe("workout");

      // navigate assigns window.location.hash; jsdom fires hashchange as a task.
      act(() => {
        result.current[1]("stats");
      });

      // waitFor polls (each poll wrapped in act) until the hashchange task fires
      // and React processes the resulting setRoute call.
      await waitFor(() => expect(result.current[0]).toBe("stats"));
      expect(window.location.hash).toBe("#stats");
    });

    it("navigate to current route is a no-op — history does not grow", () => {
      window.location.hash = "#stats";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      expect(result.current[0]).toBe("stats");

      const lengthBefore = window.history.length;

      // Same route: the guard `if (next === route) return` fires before any
      // window.location.hash assignment, so no navigation task is queued.
      act(() => {
        result.current[1]("stats");
      });

      expect(window.history.length).toBe(lengthBefore);
      expect(result.current[0]).toBe("stats");
    });
  });

  describe("external hash changes (back/forward, URL-bar edits)", () => {
    it("external hashchange to a valid route updates state", async () => {
      window.location.hash = "#workout";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      expect(result.current[0]).toBe("workout");

      // Simulates a user editing the address bar or pressing back/forward.
      window.location.hash = "#history";

      await waitFor(() => expect(result.current[0]).toBe("history"));
    });

    it("external hashchange to an invalid hash resets to fallback and rewrites URL via replaceState", async () => {
      window.location.hash = "#stats";
      const { result } = renderHook(() => useHashRoute(VALID, FALLBACK));
      // Settle on the initial valid state before installing the spy so we don't
      // pick up any replaceState that might be called during mount.
      await waitFor(() => expect(result.current[0]).toBe("stats"));

      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      window.location.hash = "#bogus-route";

      await waitFor(() => expect(result.current[0]).toBe(FALLBACK));
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", `#${FALLBACK}`);
    });
  });
});
