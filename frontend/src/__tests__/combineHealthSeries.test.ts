import { describe, it, expect } from "vitest";
import { combineHealthSeries } from "../components/health/utils";
import type { HealthSeries } from "../api";

const base: HealthSeries = {
  metric: "apple_exercise_time",
  label: "Exercise Minutes",
  unit: "min",
  points: [
    { date: "2026-07-01", value: 20, min: null, max: null, stages: null },
    { date: "2026-07-03", value: 10, min: null, max: null, stages: null },
  ],
};

describe("combineHealthSeries", () => {
  it("keeps the watch value on a shared date (no double-count)", () => {
    const out = combineHealthSeries(base, new Map([["2026-07-01", 30]]));
    expect(out.points.find((p) => p.date === "2026-07-01")!.value).toBe(20);
  });

  it("inserts app-only dates in sorted order", () => {
    const out = combineHealthSeries(base, new Map([["2026-07-02", 15]]));
    expect(out.points.map((p) => p.date)).toEqual([
      "2026-07-01", "2026-07-02", "2026-07-03",
    ]);
    expect(out.points.find((p) => p.date === "2026-07-02")!.value).toBe(15);
  });

  it("leaves points unchanged when the app map is empty", () => {
    const out = combineHealthSeries(base, new Map());
    expect(out.points).toEqual(base.points);
  });

  it("preserves metric, label and unit", () => {
    const out = combineHealthSeries(base, new Map([["2026-07-05", 5]]));
    expect(out.metric).toBe("apple_exercise_time");
    expect(out.label).toBe("Exercise Minutes");
    expect(out.unit).toBe("min");
  });
});
