import { activityKind } from "./activity";
import type { CyclingEntryResponse, RunEntryResponse, WorkoutSession } from "./api";
import { dayKey } from "./dateKey";
import { SINGLE_LETTER } from "./components/history/utils";

/** One day of the 7-day activity window, split per activity kind. */
export interface DailyActivityStat {
  date: string;
  label: string;
  workout_minutes: number;
  run_minutes: number;
  walk_minutes: number;
  boxing_minutes: number;
  cycling_minutes: number;
  run_km: number;
  walk_km: number;
  cycling_km: number;
  workout_kcal: number;
  run_kcal: number;
  walk_kcal: number;
  boxing_kcal: number;
  cycling_kcal: number;
}

function emptyDay(date: string, label: string): DailyActivityStat {
  return {
    date, label,
    workout_minutes: 0, run_minutes: 0, walk_minutes: 0, boxing_minutes: 0, cycling_minutes: 0,
    run_km: 0, walk_km: 0, cycling_km: 0,
    workout_kcal: 0, run_kcal: 0, walk_kcal: 0, boxing_kcal: 0, cycling_kcal: 0,
  };
}

/**
 * Minutes, kcal and km per day for the last 7 days (oldest first).
 *
 * Every activity is bucketed on exactly ONE day: the day of its
 * `WorkoutSession`. Runs, walks and rides live in two places — the dedicated
 * entry (which owns `distance_km`) and the mirror session (which owns duration
 * and the kcal estimate) — so minutes, energy and distance would land on
 * different days whenever those two records disagree about the date. Joining
 * the entry to its mirror through `run_entry_id` / `cycling_entry_id` makes
 * that impossible: the session decides the day, the entry only supplies km.
 *
 * Entries with no mirror session (mirror deleted, or rows predating the mirror)
 * fall back to their own `date` so they still show up.
 */
export function computeDailyActivity(
  sessions: WorkoutSession[],
  runs: RunEntryResponse[],
  rides: CyclingEntryResponse[],
  now: Date = new Date(),
): DailyActivityStat[] {
  const days: DailyActivityStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(emptyDay(dayKey(d), SINGLE_LETTER[(d.getDay() + 6) % 7]));
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  const runsById = new Map(runs.map((r) => [r.id, r]));
  const ridesById = new Map(rides.map((c) => [c.id, c]));
  const mirroredRunIds = new Set<number>();
  const mirroredRideIds = new Set<number>();

  for (const s of sessions) {
    const kind = activityKind(s.template_name);
    // Claim the linked entry even when the session falls outside the window,
    // so it is never double-counted through the orphan fallback below.
    const run = s.run_entry_id != null ? runsById.get(s.run_entry_id) : undefined;
    const ride = s.cycling_entry_id != null ? ridesById.get(s.cycling_entry_id) : undefined;
    if (run) mirroredRunIds.add(run.id);
    if (ride) mirroredRideIds.add(ride.id);

    const day = byDate.get(dayKey(new Date(s.started_at)));
    if (!day) continue;
    day[`${kind}_minutes`] += s.total_duration_seconds / 60;
    day[`${kind}_kcal`] += s.total_kcal_estimated ?? 0;
    const distance = run?.distance_km ?? ride?.distance_km;
    if (distance != null && (kind === "run" || kind === "walk" || kind === "cycling")) {
      day[`${kind}_km`] += distance;
    }
  }

  for (const r of runs) {
    if (mirroredRunIds.has(r.id)) continue;
    const day = byDate.get(r.date.slice(0, 10));
    if (!day) continue;
    const kind = r.run_type === "walk" ? "walk" : "run";
    day[`${kind}_km`] += r.distance_km;
    day[`${kind}_minutes`] += r.duration_seconds / 60;
  }

  for (const c of rides) {
    if (mirroredRideIds.has(c.id)) continue;
    const day = byDate.get(c.date.slice(0, 10));
    if (!day) continue;
    day.cycling_km += c.distance_km;
    day.cycling_minutes += c.duration_seconds / 60;
  }

  return days;
}
