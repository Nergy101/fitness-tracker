import { dayKey } from "./dateKey";

export type ChartRange = "7d" | "30d" | "all";

/** First local calendar day in the selected recent chart window, inclusive. */
export function chartRangeStart(range: ChartRange, now = new Date()): string | null {
  if (range === "all") return null;
  const start = new Date(now);
  start.setDate(start.getDate() - (range === "7d" ? 6 : 29));
  return dayKey(start);
}

