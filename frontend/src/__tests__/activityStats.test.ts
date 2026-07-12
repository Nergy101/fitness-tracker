import { describe, it, expect } from "vitest";
import { activityStats } from "../components/health/utils";
import type { WorkoutSession } from "../api";

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: 1,
    template_id: null,
    template_name: "Push Day",
    started_at: "2026-07-01T10:00:00Z",
    finished_at: null,
    total_duration_seconds: 0,
    total_kcal_estimated: 0,
    notes: "",
    boxing_entry_id: null,
    run_entry_id: null,
    exercises: [],
    ...overrides,
  };
}

const sessions: WorkoutSession[] = [
  session({ id: 1, template_name: "Push Day", started_at: "2026-07-01T10:00:00Z", total_duration_seconds: 1800, total_kcal_estimated: 200 }),
  session({ id: 2, template_name: "Pull Day", started_at: "2026-06-20T10:00:00Z", total_duration_seconds: 3600, total_kcal_estimated: 400 }),
  session({ id: 3, template_name: "Run: 5.0km", started_at: "2026-07-02T10:00:00Z", total_duration_seconds: 1500, total_kcal_estimated: 300 }),
  session({ id: 4, template_name: "Walk: 2.0km", started_at: "2026-07-03T10:00:00Z", total_duration_seconds: 900, total_kcal_estimated: 90 }),
  session({ id: 5, template_name: "Boxing: 30min", started_at: "2026-07-04T10:00:00Z", total_duration_seconds: 1800, total_kcal_estimated: 300 }),
];

describe("activityStats", () => {
  it("aggregates only sessions of the requested kind", () => {
    const s = activityStats(sessions, "workout");
    expect(s.sessions).toBe(2); // Push + Pull, excludes run/walk/boxing mirrors
    expect(s.total_hours).toBe(1.5); // (1800 + 3600) / 3600
    expect(s.total_kcal_estimated).toBe(600);
  });

  it("computes avg session duration and kcal/min", () => {
    const s = activityStats(sessions, "workout");
    expect(s.avg_duration_seconds).toBe(2700); // (1800 + 3600) / 2
    // 600 kcal over 90 min = 6.67 kcal/min
    expect(s.avg_kcal_per_min).toBeCloseTo(600 / 90, 5);
  });

  it("classifies run/walk/boxing mirror sessions by prefix", () => {
    expect(activityStats(sessions, "run").sessions).toBe(1);
    expect(activityStats(sessions, "walk").sessions).toBe(1);
    expect(activityStats(sessions, "boxing").sessions).toBe(1);
    expect(activityStats(sessions, "run").total_kcal_estimated).toBe(300);
  });

  it("builds a newest-first monthly breakdown", () => {
    const s = activityStats(sessions, "workout");
    expect(s.monthly_breakdown.map((m) => m.month)).toEqual(["2026-07", "2026-06"]);
    expect(s.monthly_breakdown[0]).toEqual({ month: "2026-07", sessions: 1, total_minutes: 30 });
    expect(s.monthly_breakdown[1]).toEqual({ month: "2026-06", sessions: 1, total_minutes: 60 });
  });

  it("returns zeroed stats and null averages for an absent kind", () => {
    const s = activityStats([], "workout");
    expect(s.sessions).toBe(0);
    expect(s.total_hours).toBe(0);
    expect(s.total_kcal_estimated).toBe(0);
    expect(s.avg_duration_seconds).toBeNull();
    expect(s.avg_kcal_per_min).toBeNull();
    expect(s.monthly_breakdown).toEqual([]);
  });
});
