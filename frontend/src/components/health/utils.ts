import type { HealthSeries } from "../../api";

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
