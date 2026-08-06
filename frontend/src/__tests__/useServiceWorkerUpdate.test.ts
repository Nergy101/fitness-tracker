import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the virtual PWA register module — vitest mocks virtual ids the same as
// any other module specifier.
const mockUseRegisterSW = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => mockUseRegisterSW(...args),
}));

// Import after the mock is registered (hoisted by vitest anyway, but explicit).
import useServiceWorkerUpdate from "../useServiceWorkerUpdate";

describe("useServiceWorkerUpdate", () => {
  const mockUpdateServiceWorker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRegisterSW.mockReturnValue({
      needRefresh: [false],
      updateServiceWorker: mockUpdateServiceWorker,
    });
  });

  it("returns needRefresh=false when the SW is not waiting", () => {
    mockUseRegisterSW.mockReturnValue({
      needRefresh: [false],
      updateServiceWorker: mockUpdateServiceWorker,
    });
    const { result } = renderHook(() => useServiceWorkerUpdate());
    expect(result.current.needRefresh).toBe(false);
  });

  it("returns needRefresh=true when a new SW is waiting", () => {
    mockUseRegisterSW.mockReturnValue({
      needRefresh: [true],
      updateServiceWorker: mockUpdateServiceWorker,
    });
    const { result } = renderHook(() => useServiceWorkerUpdate());
    expect(result.current.needRefresh).toBe(true);
  });

  it("update() activates the waiting service worker", () => {
    mockUseRegisterSW.mockReturnValue({
      needRefresh: [true],
      updateServiceWorker: mockUpdateServiceWorker,
    });
    const { result } = renderHook(() => useServiceWorkerUpdate());
    act(() => {
      result.current.update();
    });
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("passes an onOfflineReady callback to suppress first-install notifications", () => {
    renderHook(() => useServiceWorkerUpdate());
    expect(mockUseRegisterSW).toHaveBeenCalledWith(
      expect.objectContaining({
        onOfflineReady: expect.any(Function),
      }),
    );
  });
});
