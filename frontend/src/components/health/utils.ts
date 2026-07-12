import type { HealthSeries } from "../../api";

/** "2026-07-06" → "Jul 6" (locale-aware). */
export function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Merge app-logged per-day values into an Apple Health series: sum on shared
 *  dates, insert app-only dates, re-sort ascending. Completes Exercise Minutes /
 *  Active Energy when the watch under-reports but the workout was logged in-app.
 *  `appByDate` maps ISO date -> app value already in the series' unit (min or kcal). */
export function combineHealthSeries(
  series: HealthSeries,
  appByDate: Map<string, number>,
): HealthSeries {
  const byDate = new Map<string, number>();
  for (const p of series.points) byDate.set(p.date, p.value);
  for (const [d, v] of appByDate) byDate.set(d, (byDate.get(d) ?? 0) + v);
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
