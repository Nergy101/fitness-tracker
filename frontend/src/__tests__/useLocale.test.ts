import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocale } from "../useLocale";

// Mock the locale store
let mockListeners: Array<() => void> = [];
let mockCurrent: "dmy" | "mdy" = "dmy";

vi.mock("../locale", () => ({
  getDateLocale: vi.fn(() => mockCurrent),
  setDateLocale: vi.fn((value: "dmy" | "mdy") => {
    if (value === mockCurrent) return;
    mockCurrent = value;
    mockListeners.forEach((l) => l());
  }),
  subscribeLocale: vi.fn((listener: () => void) => {
    mockListeners.push(listener);
    return () => {
      mockListeners = mockListeners.filter((l) => l !== listener);
    };
  }),
}));

describe("useLocale", () => {
  beforeEach(() => {
    mockCurrent = "dmy";
    mockListeners = [];
  });

  it("returns current locale", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe("dmy");
  });

  it("setLocale changes the locale", () => {
    const { result } = renderHook(() => useLocale());
    act(() => result.current.setLocale("mdy"));
    expect(result.current.locale).toBe("mdy");
  });

  it("toggleLocale switches dmy → mdy", () => {
    mockCurrent = "dmy";
    const { result } = renderHook(() => useLocale());
    act(() => result.current.toggleLocale());
    expect(result.current.locale).toBe("mdy");
  });

  it("toggleLocale switches mdy → dmy", () => {
    mockCurrent = "mdy";
    const { result } = renderHook(() => useLocale());
    act(() => result.current.toggleLocale());
    expect(result.current.locale).toBe("dmy");
  });

  it("reacts to external locale change via subscription", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe("dmy");

    // Simulate external change
    act(() => {
      mockCurrent = "mdy";
      mockListeners.forEach((l) => l());
    });

    expect(result.current.locale).toBe("mdy");
  });

  it("setLocale no-ops when setting same value", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe("dmy");
    act(() => result.current.setLocale("dmy"));
    expect(result.current.locale).toBe("dmy");
  });

  it("returns locale controls with all three methods", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBeDefined();
    expect(typeof result.current.setLocale).toBe("function");
    expect(typeof result.current.toggleLocale).toBe("function");
  });

  it("multiple hooks share state via subscription", () => {
    const hook1 = renderHook(() => useLocale());
    const hook2 = renderHook(() => useLocale());

    expect(hook1.result.current.locale).toBe("dmy");
    expect(hook2.result.current.locale).toBe("dmy");

    act(() => hook1.result.current.toggleLocale());

    expect(hook1.result.current.locale).toBe("mdy");
    expect(hook2.result.current.locale).toBe("mdy");
  });
});