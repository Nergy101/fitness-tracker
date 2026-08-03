import { describe, expect, it, beforeEach } from "vitest";
import { formatWeekLabel, setDateLocale } from "../locale";

describe("formatWeekLabel", () => {
  beforeEach(() => {
    setDateLocale("dmy");
  });

  it("formats ISO week-start dates in dmy", () => {
    expect(formatWeekLabel("2026-07-14")).toBe("14/7");
  });

  it("formats ISO week-start dates in mdy", () => {
    setDateLocale("mdy");
    expect(formatWeekLabel("2026-07-14")).toBe("7/14");
  });

  it("passes through already-short day labels unchanged", () => {
    expect(formatWeekLabel("M")).toBe("M");
    expect(formatWeekLabel("Mon")).toBe("Mon");
  });

  it("passes through single-digit day labels (no leading zero)", () => {
    // e.g. "3/7" style labels that are already formatted
    expect(formatWeekLabel("3/7")).toBe("3/7");
  });

  it("respects an explicit locale argument", () => {
    expect(formatWeekLabel("2026-07-14", "mdy")).toBe("7/14");
    expect(formatWeekLabel("2026-07-14", "dmy")).toBe("14/7");
  });
});
