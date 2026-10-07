import { dayKey } from "./dateKey";

export type ChartRange = "30d" | "all";

/** First local calendar day in the rolling 30-day chart window, inclusive. */
export function chartRangeStart(range: ChartRange, now = new Date()): string | null {
  if (range === "all") return null;
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return dayKey(start);
}

