import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "../useWakeLock";

// jsdom has no Screen Wake Lock API — install a mock on navigator.
let requestMock: ReturnType<typeof vi.fn>;
let releaseMock: ReturnType<typeof vi.fn>;
let releaseHandler: (() => void) | null;

function installWakeLockMock() {
  requestMock = vi.fn();
  releaseMock = vi.fn().mockResolvedValue(undefined);
  releaseHandler = null;
  const sentinel = {
    release: releaseMock,
    addEventListener: (_type: string, cb: () => void) => {
      releaseHandler = cb;
    },
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, "wakeLock", {
    value: { request: requestMock },
    configurable: true,
  });
  requestMock.mockResolvedValue(sentinel);
}

beforeEach(() => {
  installWakeLockMock();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
  vi.restoreAllMocks();
});

describe("useWakeLock", () => {
  it("acquires the screen lock while active", () => {
    renderHook(() => useWakeLock(true));

    expect(requestMock).toHaveBeenCalledWith("screen");
  });

  it("does not acquire when inactive", () => {
    renderHook(() => useWakeLock(false));

    expect(requestMock).not.toHaveBeenCalled();
  });

  it("releases the lock on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    expect(requestMock).toHaveBeenCalledTimes(1);
    // Flush the microtask so the async acquire settles and `lock` is held.
    await act(async () => {});

    unmount();

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("releases the lock when active becomes false", async () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useWakeLock(active),
      { initialProps: { active: true } },
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
    await act(async () => {});

    rerender({ active: false });

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("re-acquires when the lock is released and the tab becomes visible again", async () => {
    renderHook(() => useWakeLock(true));
    expect(requestMock).toHaveBeenCalledTimes(1);
    // Flush the microtask so the release listener is registered.
    await act(async () => {});

    // Simulate the browser auto-releasing the lock (e.g. tab hidden).
    await act(async () => {
      releaseHandler?.();
    });

    // jsdom's visibilityState defaults to "visible", so the next
    // visibilitychange triggers a re-acquire.
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when the Wake Lock API is unsupported", () => {
    Reflect.deleteProperty(navigator, "wakeLock");

    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("is a no-op when the lock request is rejected", async () => {
    requestMock.mockRejectedValue(new Error("NotAllowedError"));

    await act(async () => {
      renderHook(() => useWakeLock(true));
    });

    expect(requestMock).toHaveBeenCalledTimes(1);
    // The rejected acquire must not surface as an unhandled rejection — the
    // test itself passing (no unhandled error) is the assertion.
  });
});
