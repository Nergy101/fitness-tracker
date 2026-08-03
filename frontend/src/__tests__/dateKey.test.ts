import { describe, it, expect, vi, afterEach } from "vitest";
import { dayKey, todayKey } from "../dateKey";

describe("dateKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a date as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 6, 29))).toBe("2026-07-29");
  });

  it("zero-pads single-digit month and day", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local calendar day, not the UTC one", () => {
    // 1 August 00:30 local. `toISOString().slice(0, 10)` returns 31 July for any
    // timezone east of Greenwich, which files activities on the wrong day.
    const justAfterMidnight = new Date(2026, 7, 1, 0, 30);
    expect(dayKey(justAfterMidnight)).toBe("2026-08-01");
  });

  it("todayKey follows the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 1, 0, 30));
    expect(todayKey()).toBe("2026-08-01");
  });
});
