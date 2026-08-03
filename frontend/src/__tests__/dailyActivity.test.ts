import { describe, it, expect } from "vitest";
import { computeDailyActivity, type DailyActivityStat } from "../dailyActivity";
import type { CyclingEntryResponse, RunEntryResponse, WorkoutSession } from "../api";

// Saturday 1 August 2026, 00:30 local — the "just past midnight" case where
// UTC and local dates disagree.
const NOW = new Date(2026, 7, 1, 0, 30);

function session(overrides: Partial<WorkoutSession> & { started_at: string }): WorkoutSession {
  return {
    id: 1,
    template_id: null,
    template_name: "Morning Routine",
    finished_at: null,
    total_duration_seconds: 1800,
    total_kcal_estimated: 200,
    notes: "",
    boxing_entry_id: null,
    run_entry_id: null,
    cycling_entry_id: null,
    exercises: [],
    ...overrides,
  };
}

function ride(overrides: Partial<CyclingEntryResponse> = {}): CyclingEntryResponse {
  return {
    id: 1,
    duration_seconds: 5400,
    distance_km: 27.8,
    date: "2026-07-31",
    notes: "",
    created_at: "2026-07-31T20:00:00",
    ...overrides,
  };
}

function run(overrides: Partial<RunEntryResponse> = {}): RunEntryResponse {
  return {
    id: 1,
    duration_seconds: 1800,
    distance_km: 5.0,
    pace_per_km: 360,
    run_type: "run",
    date: "2026-07-31",
    notes: "",
    created_at: "2026-07-31T18:00:00",
    ...overrides,
  };
}

function day(days: DailyActivityStat[], date: string) {
  const found = days.find((d) => d.date === date);
  if (!found) throw new Error(`no bucket for ${date} in ${days.map((d) => d.date).join(",")}`);
  return found;
}

describe("computeDailyActivity", () => {
  it("returns seven buckets ending today, labelled Monday-first", () => {
    const days = computeDailyActivity([], [], [], NOW);
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29",
      "2026-07-30", "2026-07-31", "2026-08-01",
    ]);
    expect(days.map((d) => d.label)).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });

  it("keeps minutes, energy and distance of one ride on the same day", () => {
    // The bug: the ride entry says 1 Aug while its mirror session says 31 Jul,
    // so minutes/kcal landed on Friday and the distance on Saturday — and the
    // Saturday minutes fallback invented a third cycling day.
    const days = computeDailyActivity(
      [session({
        id: 9, template_id: null, template_name: "Cycling: 27.8km",
        started_at: "2026-07-31T00:00:00", total_duration_seconds: 5400,
        total_kcal_estimated: 738, cycling_entry_id: 4,
      })],
      [],
      [ride({ id: 4, date: "2026-08-01" })],
      NOW,
    );

    const friday = day(days, "2026-07-31");
    expect(friday.cycling_minutes).toBe(90);
    expect(friday.cycling_kcal).toBe(738);
    expect(friday.cycling_km).toBe(27.8);

    const saturday = day(days, "2026-08-01");
    expect(saturday.cycling_minutes).toBe(0);
    expect(saturday.cycling_kcal).toBe(0);
    expect(saturday.cycling_km).toBe(0);
  });

  it("reports exactly the days that were ridden", () => {
    const days = computeDailyActivity(
      [
        session({
          id: 1, template_id: null, template_name: "Cycling: 24.0km",
          started_at: "2026-07-30T00:00:00", total_duration_seconds: 4200,
          total_kcal_estimated: 600, cycling_entry_id: 1,
        }),
        session({
          id: 2, template_id: null, template_name: "Cycling: 27.8km",
          started_at: "2026-07-31T00:00:00", total_duration_seconds: 5400,
          total_kcal_estimated: 738, cycling_entry_id: 2,
        }),
      ],
      [],
      [
        ride({ id: 1, date: "2026-07-30", distance_km: 24.0, duration_seconds: 4200 }),
        ride({ id: 2, date: "2026-08-01", distance_km: 27.8 }),
      ],
      NOW,
    );

    const ridden = days.filter((d) => d.cycling_minutes > 0).map((d) => d.date);
    const withEnergy = days.filter((d) => d.cycling_kcal > 0).map((d) => d.date);
    const withDistance = days.filter((d) => d.cycling_km > 0).map((d) => d.date);

    expect(ridden).toEqual(["2026-07-30", "2026-07-31"]);
    expect(withEnergy).toEqual(ridden);
    expect(withDistance).toEqual(ridden);
  });

  it("takes run kcal from the mirror instead of re-estimating it", () => {
    const days = computeDailyActivity(
      [session({
        id: 3, template_id: null, template_name: "Run: 5.0km",
        started_at: "2026-07-31T00:00:00", total_duration_seconds: 1800,
        total_kcal_estimated: 363.8, run_entry_id: 1,
      })],
      [run({ id: 1 })],
      [],
      NOW,
    );

    const friday = day(days, "2026-07-31");
    expect(friday.run_kcal).toBe(363.8);
    expect(friday.run_minutes).toBe(30);
    expect(friday.run_km).toBe(5.0);
  });

  it("splits walks from runs and keeps their distance on the mirror's day", () => {
    const days = computeDailyActivity(
      [session({
        id: 4, template_id: null, template_name: "Walk: 3.0km",
        started_at: "2026-07-29T00:00:00", total_duration_seconds: 2400,
        total_kcal_estimated: 112.5, run_entry_id: 7,
      })],
      [run({ id: 7, run_type: "walk", distance_km: 3.0, duration_seconds: 2400, date: "2026-07-29" })],
      [],
      NOW,
    );

    const wednesday = day(days, "2026-07-29");
    expect(wednesday.walk_km).toBe(3.0);
    expect(wednesday.walk_minutes).toBe(40);
    expect(wednesday.run_km).toBe(0);
  });

  it("still shows an entry whose mirror session is gone", () => {
    const days = computeDailyActivity([], [], [ride({ id: 5, date: "2026-07-30" })], NOW);

    const thursday = day(days, "2026-07-30");
    expect(thursday.cycling_km).toBe(27.8);
    expect(thursday.cycling_minutes).toBe(90);
  });

  it("does not double-count an entry whose mirror falls outside the window", () => {
    const days = computeDailyActivity(
      [session({
        id: 6, template_id: null, template_name: "Cycling: 27.8km",
        started_at: "2026-07-01T00:00:00", total_duration_seconds: 5400,
        cycling_entry_id: 6, total_kcal_estimated: 700,
      })],
      [],
      [ride({ id: 6, date: "2026-07-30" })],
      NOW,
    );

    expect(days.every((d) => d.cycling_km === 0)).toBe(true);
    expect(days.every((d) => d.cycling_minutes === 0)).toBe(true);
  });

  it("sums two activities of the same kind on one day", () => {
    const days = computeDailyActivity(
      [
        session({ id: 7, started_at: "2026-07-30T08:00:00", total_duration_seconds: 1800, total_kcal_estimated: 150 }),
        session({ id: 8, started_at: "2026-07-30T19:00:00", total_duration_seconds: 900, total_kcal_estimated: 90 }),
      ],
      [], [], NOW,
    );

    const thursday = day(days, "2026-07-30");
    expect(thursday.workout_minutes).toBe(45);
    expect(thursday.workout_kcal).toBe(240);
  });
});
