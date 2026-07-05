import { describe, it, expect } from "vitest";
import { formatDate, formatDateFull } from "../format";

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it('returns time for today\'s date', () => {
    const today = new Date();
    today.setHours(14, 30, 0, 0);
    const result = formatDate(today.toISOString());
    // Should show time like "2:30 PM" or "14:30"
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000);
    expect(formatDate(yesterday.toISOString())).toBe("Yesterday");
  });

  it("returns short date for older dates", () => {
    const old = new Date("2026-07-01");
    const result = formatDate(old.toISOString());
    expect(result).toContain("Jul");
    expect(result).toContain("1");
  });
});

describe("formatDateFull", () => {
  it("returns empty string for null", () => {
    expect(formatDateFull(null)).toBe("");
  });

  it("includes weekday and month", () => {
    const d = new Date("2026-07-04T14:30:00");
    const result = formatDateFull(d.toISOString());
    expect(result).toContain("Sat");
    expect(result).toContain("July");
    expect(result).toContain("4");
  });
});