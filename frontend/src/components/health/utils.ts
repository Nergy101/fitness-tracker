import type { HealthSeries, WorkoutSession } from "../../api";
import { activityKind, type ActivityKind } from "../../activity";

/** "2026-07-06" → "Jul 6" (locale-aware). */
export function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Fill an Apple Health series with app-logged per-day values: on dates the
 *  watch already recorded, keep the watch value (no double-count); on dates the
 *  watch missed, insert the app value. Re-sort ascending. Completes Exercise
 *  Minutes / Active Energy for days logged in-app but absent from the watch.
 *  `appByDate` maps ISO date -> app value already in the series' unit (min or kcal). */
export function combineHealthSeries(
  series: HealthSeries,
  appByDate: Map<string, number>,
): HealthSeries {
  const byDate = new Map<string, number>();
  for (const p of series.points) byDate.set(p.date, p.value);
  for (const [d, v] of appByDate) if (!byDate.has(d)) byDate.set(d, v);
  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      value: Math.round(value * 10) / 10,
      min: null,
      max: null,
      stages: null,
    }));
  return { ...series, points };
}

export interface ActivityMonth {
  month: string;
  sessions: number;
  total_minutes: number;
}

export interface ActivityStats {
  sessions: number;
  total_hours: number;
  avg_duration_seconds: number | null;
  total_kcal_estimated: number;
  avg_kcal_per_min: number | null;
  monthly_breakdown: ActivityMonth[];
}

/** All-time aggregate for one activity kind, computed from the full session
 *  list. Run/walk/boxing mirror sessions carry their entry's time & kcal, so
 *  there's exactly one session per activity (see is_mirror_session on the
 *  backend) — summing per kind neither double-counts nor drops any. Mirrors the
 *  shape of the backend boxing-stats endpoint (newest-first monthly, ≤12). */
export function activityStats(
  sessions: WorkoutSession[],
  kind: ActivityKind,
): ActivityStats {
  const mine = sessions.filter((s) => activityKind(s.template_name) === kind);
  let totalSeconds = 0;
  let totalKcal = 0;
  const months = new Map<string, { sessions: number; minutes: number }>();
  for (const s of mine) {
    const secs = s.total_duration_seconds || 0;
    totalSeconds += secs;
    totalKcal += s.total_kcal_estimated || 0;
    const month = (s.started_at ?? "").slice(0, 7);
    if (month) {
      const m = months.get(month) ?? { sessions: 0, minutes: 0 };
      m.sessions += 1;
      m.minutes += secs / 60;
      months.set(month, m);
    }
  }
  const totalMinutes = totalSeconds / 60;
  return {
    sessions: mine.length,
    total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
    avg_duration_seconds: mine.length ? totalSeconds / mine.length : null,
    total_kcal_estimated: totalKcal,
    avg_kcal_per_min: totalMinutes > 0 ? totalKcal / totalMinutes : null,
    monthly_breakdown: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, v]) => ({
        month,
        sessions: v.sessions,
        total_minutes: Math.round(v.minutes),
      })),
  };
}
