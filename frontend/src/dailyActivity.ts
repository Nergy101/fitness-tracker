import { activityKind } from "./activity";
import type { CyclingEntryResponse, RunEntryResponse, WorkoutSession } from "./api";
import { dayKey } from "./dateKey";
import { SINGLE_LETTER } from "./components/history/utils";

/** Daily activity statistics used by chart views. */
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
 * Minutes, kcal and distance per day, oldest first. An ISO start date creates
 * 30 daily buckets; `null` includes all dates with activity; `undefined`
 * preserves the compact last-seven-days chart. Activities use their mirror
 * session day, with orphan entries falling back to their own date.
 */
export function computeDailyActivity(
  sessions: WorkoutSession[],
  runs: RunEntryResponse[],
  rides: CyclingEntryResponse[],
  now: Date = new Date(),
  startDate?: string | null,
): DailyActivityStat[] {
  const byDate = new Map<string, DailyActivityStat>();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 6);
  const defaultStartKey = dayKey(defaultStart);
  const today = dayKey(now);
  const ensureDay = (date: string) => {
    if (startDate === null && date > today) return undefined;
    if (typeof startDate === "string" && (date < startDate || date > today)) return undefined;
    if (startDate === undefined && date < defaultStartKey) return undefined;
    let day = byDate.get(date);
    if (!day) {
      const d = new Date(`${date}T12:00:00`);
      day = emptyDay(date, startDate ? String(d.getDate()) : SINGLE_LETTER[(d.getDay() + 6) % 7]);
      byDate.set(date, day);
    }
    return day;
  };

  if (startDate) {
    const d = new Date(`${startDate}T12:00:00`);
    for (let i = 0; i < 30; i++) {
      const current = new Date(d);
      current.setDate(d.getDate() + i);
      ensureDay(dayKey(current));
    }
  } else if (startDate === undefined) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      ensureDay(dayKey(d));
    }
  }

  const runsById = new Map(runs.map((r) => [r.id, r]));
  const ridesById = new Map(rides.map((c) => [c.id, c]));
  const mirroredRunIds = new Set<number>();
  const mirroredRideIds = new Set<number>();

  for (const session of sessions) {
    const kind = activityKind(session.template_name);
    const run = session.run_entry_id == null ? undefined : runsById.get(session.run_entry_id);
    const ride = session.cycling_entry_id == null ? undefined : ridesById.get(session.cycling_entry_id);
    if (run) mirroredRunIds.add(run.id);
    if (ride) mirroredRideIds.add(ride.id);

    const day = ensureDay(dayKey(new Date(session.started_at)));
    if (!day) continue;
    day[`${kind}_minutes`] += session.total_duration_seconds / 60;
    day[`${kind}_kcal`] += session.total_kcal_estimated ?? 0;
    const distance = run?.distance_km ?? ride?.distance_km;
    if (distance != null && (kind === "run" || kind === "walk" || kind === "cycling")) {
      day[`${kind}_km`] += distance;
    }
  }

  for (const run of runs) {
    if (mirroredRunIds.has(run.id)) continue;
    const day = ensureDay(run.date.slice(0, 10));
    if (!day) continue;
    const kind = run.run_type === "walk" ? "walk" : "run";
    day[`${kind}_km`] += run.distance_km;
    day[`${kind}_minutes`] += run.duration_seconds / 60;
  }

  for (const ride of rides) {
    if (mirroredRideIds.has(ride.id)) continue;
    const day = ensureDay(ride.date.slice(0, 10));
    if (!day) continue;
    day.cycling_km += ride.distance_km;
    day.cycling_minutes += ride.duration_seconds / 60;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
