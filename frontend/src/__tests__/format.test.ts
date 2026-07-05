import { describe, it, expect } from "vitest";
import { formatDuration, formatHours, formatDateRelative } from "../format";

describe("formatDuration", () => {
  it("returns 0s for zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(3661)).toBe("61m 1s");
  });

  it("handles falsy values", () => {
    expect(formatDuration(0)).toBe("0s");
    // @ts-expect-error testing edge case
    expect(formatDuration(null)).toBe("0s");
    // @ts-expect-error testing edge case
    expect(formatDuration(undefined)).toBe("0s");
  });
});

describe("formatHours", () => {
  it("returns 0m for zero", () => {
    expect(formatHours(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatHours(45)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatHours(60)).toBe("1h 0m");
    expect(formatHours(90)).toBe("1h 30m");
    expect(formatHours(150)).toBe("2h 30m");
  });
});

describe("formatDateRelative", () => {
  it('returns "Just now" for recent dates', () => {
    const now = new Date();
    expect(formatDateRelative(now.toISOString())).toBe("Just now");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
    expect(formatDateRelative(threeHoursAgo.toISOString())).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
    expect(formatDateRelative(twoDaysAgo.toISOString())).toBe("2d ago");
  });

  it("returns empty string for null", () => {
    expect(formatDateRelative(null)).toBe("");
  });
});