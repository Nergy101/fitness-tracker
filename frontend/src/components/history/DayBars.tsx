import { useMemo } from "react";
import type { WorkoutSession } from "../../api";
import { ACTIVITY_COLORS } from "../../activity";
import { shortDate } from "../../locale";
import { useLocale } from "../../useLocale";
import ActivityLegend from "../ActivityLegend";
import { countsByDay, dayKey, SINGLE_LETTER, type DayCounts } from "./utils";

/** Per-date bars with weekday letter + short date underneath. "week" shows
 *  Mon–Sun of the current week; "7d" shows a rolling window ending today
 *  (today rightmost). */
export default function DayBars({
  sessions,
  mode,
}: {
  sessions: WorkoutSession[];
  mode: "week" | "7d";
}) {
  const { locale } = useLocale();
  const days = useMemo(() => {
    const byDay = countsByDay(sessions);
    const now = new Date();
    const empty: DayCounts = { workout: 0, run: 0, walk: 0 };
    const items: { key: string; counts: DayCounts; label: string; date: Date }[] = [];
    if (mode === "week") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        items.push({ key: dayKey(d), counts: byDay.get(dayKey(d)) ?? empty, label: SINGLE_LETTER[i], date: d });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        items.push({
          key: dayKey(d),
          counts: byDay.get(dayKey(d)) ?? empty,
          label: SINGLE_LETTER[(d.getDay() + 6) % 7],
          date: d,
        });
      }
    }
    return { items, todayKey: dayKey(now) };
  }, [sessions, mode]);
  const max = Math.max(1, ...days.items.map((d) => d.counts.workout + d.counts.run + d.counts.walk));

  return (
    <div>
      <div className="flex items-end gap-1.5 h-24">
        {days.items.map((d) => {
          const today = d.key === days.todayKey;
          const total = d.counts.workout + d.counts.run + d.counts.walk;
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5">
              <span
                className={`text-[10px] font-semibold ${total > 0 ? "text-fg/60" : "text-transparent"}`}
              >
                {total}
              </span>
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col justify-end transition-all"
                style={{
                  height: `${total > 0 ? 6 + (total / max) * 40 : 3}px`,
                  background: total > 0 ? undefined : "var(--track)",
                }}
              >
                {(["walk", "run", "workout"] as const).map((kind) =>
                  d.counts[kind] > 0 ? (
                    <div
                      key={kind}
                      style={{
                        height: `${(d.counts[kind] / total) * 100}%`,
                        background: ACTIVITY_COLORS[kind],
                      }}
                    />
                  ) : null,
                )}
              </div>
              <span
                className={`text-[10px] leading-tight ${today ? "text-fg font-bold" : "text-fg/30"}`}
              >
                {d.label}
              </span>
              <span
                className={`text-[9px] leading-tight ${today ? "text-fg/70" : "text-fg/25"}`}
              >
                {shortDate(d.date, locale)}
              </span>
            </div>
          );
        })}
      </div>
      <ActivityLegend kinds={["workout", "run", "walk"]} />
    </div>
  );
}
