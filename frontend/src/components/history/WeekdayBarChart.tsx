import { useMemo } from "react";
import type { WorkoutSession } from "../../api";
import { ACTIVITY_COLORS, activityKind } from "../../activity";
import ActivityLegend from "../ActivityLegend";
import { WEEKDAY_LABELS } from "./utils";

/** Bars per weekday (Mon–Sun), stacked by activity type. */
export default function WeekdayBarChart({ sessions }: { sessions: WorkoutSession[] }) {
  const buckets = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => ({ workout: 0, run: 0, walk: 0, boxing: 0 }));
    for (const s of sessions) {
      const day = new Date(s.started_at).getDay(); // 0=Sun
      counts[(day + 6) % 7][activityKind(s.template_name)]++;
    }
    return counts;
  }, [sessions]);
  const max = Math.max(1, ...buckets.map((b) => b.workout + b.run + b.walk + b.boxing));

  return (
    <div>
      <div className="flex items-end gap-1.5 h-40">
        {buckets.map((b, i) => {
          const total = b.workout + b.run + b.walk + b.boxing;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span
                className={`text-[10px] font-semibold ${total > 0 ? "text-fg/60" : "text-transparent"}`}
              >
                {total}
              </span>
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col justify-end transition-all"
                style={{
                  height: `${total > 0 ? 12 + (total / max) * 100 : 6}px`,
                  background: total > 0 ? undefined : "var(--track)",
                }}
              >
                {(["boxing", "walk", "run", "workout"] as const).map((kind) =>
                  b[kind] > 0 ? (
                    <div
                      key={kind}
                      style={{
                        height: `${(b[kind] / total) * 100}%`,
                        background: ACTIVITY_COLORS[kind],
                      }}
                    />
                  ) : null,
                )}
              </div>
              <span className="text-[10px] text-fg/30">{WEEKDAY_LABELS[i]}</span>
            </div>
          );
        })}
      </div>
      <ActivityLegend kinds={["workout", "run", "walk", "boxing"]} />
    </div>
  );
}
