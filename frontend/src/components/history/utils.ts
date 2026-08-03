import { activityKind, type ActivityKind } from "../../activity";
import type { WorkoutSession } from "../../api";
import { dayKey } from "../../dateKey";

// Monday-first weekday labels; map JS getDay() (0=Sun) via (day + 6) % 7.
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SINGLE_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

export type RangeKey = "week" | "7d" | "30d";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "week", label: "This week" },
];

export function rangeStart(key: RangeKey): Date {
  const now = new Date();
  if (key === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // back to Monday
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = key === "7d" ? 7 : 30;
  const d = new Date(now);
  d.setDate(now.getDate() - days);
  return d;
}

export type DayCounts = Record<ActivityKind, number>;

export function countsByDay(sessions: WorkoutSession[]): Map<string, DayCounts> {
  const m = new Map<string, DayCounts>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.started_at));
    const c = m.get(k) ?? { workout: 0, run: 0, walk: 0, boxing: 0, cycling: 0 };
    c[activityKind(s.template_name)]++;
    m.set(k, c);
  }
  return m;
}
