import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
Object.defineProperty(window, "matchMedia", { value: matchMediaMock });

// We need to dynamically import to avoid SSR issues with the hook
describe("useTheme", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system mode (light when no preference)", async () => {
    matchMediaMock.mockReturnValue({
      ...matchMediaMock(),
      matches: false,
    });
    const { useTheme } = await import("../useTheme");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
    expect(result.current.theme).toBe("light");
  });

  it("defaults to system mode (dark when prefers-color-scheme: dark)", async () => {
    matchMediaMock.mockReturnValue({
      ...matchMediaMock(),
      matches: true,
    });
    localStorageMock.getItem.mockReturnValue(null); // force no stored value

    // Must re-import to pick up the new matchMedia
    vi.resetModules();
    const { useTheme } = await import("../useTheme");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
    expect(result.current.theme).toBe("dark");
  });

  it("respects stored light preference", async () => {
    localStorageMock.getItem.mockReturnValue("light");
    vi.resetModules();
    const { useTheme } = await import("../useTheme");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("light");
    expect(result.current.theme).toBe("light");
  });

  it("respects stored dark preference", async () => {
    localStorageMock.getItem.mockReturnValue("dark");
    vi.resetModules();
    const { useTheme } = await import("../useTheme");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("dark");
    expect(result.current.theme).toBe("dark");
  });

  it("cycles system → light → dark → system", async () => {
    localStorageMock.clear();
    localStorageMock.getItem.mockReturnValue(null);
    matchMediaMock.mockReturnValue({
      ...matchMediaMock(),
      matches: false,
    });
    vi.resetModules();
    const { useTheme } = await import("../useTheme");
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("system");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("light");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("dark");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("system");
  });

  it("applies dark class to document when theme is dark", async () => {
    matchMediaMock.mockReturnValue({
      ...matchMediaMock(),
      matches: true,
    });
    vi.resetModules();
    const { useTheme } = await import("../useTheme");
    renderHook(() => useTheme());

    // After the effect, dark class should be applied
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});