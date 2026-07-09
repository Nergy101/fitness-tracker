import { useMemo } from "react";
import type { WorkoutSession } from "../../api";
import { countsByDay, dayKey, SINGLE_LETTER } from "./utils";

// GitHub-style intensity: transparent-ish → full accent as count rises.
function cellColor(count: number): string {
  if (count <= 0) return "var(--track)";
  const pct = [45, 65, 85, 100][Math.min(count - 1, 3)];
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

/** 30-day contribution heatmap: columns = weekdays (Mon–Sun), rows = weeks,
 *  latest week at the bottom. Weekday letters label the columns. */
export default function HeatmapChart({ sessions }: { sessions: WorkoutSession[] }) {
  const weeks = useMemo(() => {
    const byDay = countsByDay(sessions);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 29); // 30-day window incl. today
    // Grid starts on the Monday on/before windowStart.
    const gridStart = new Date(windowStart);
    gridStart.setDate(windowStart.getDate() - ((windowStart.getDay() + 6) % 7));

    const rows: { key: string; count: number; inRange: boolean }[][] = [];
    const cursor = new Date(gridStart);
    while (cursor <= today) {
      const row: { key: string; count: number; inRange: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const k = dayKey(cursor);
        const inRange = cursor >= windowStart && cursor <= today;
        const c = byDay.get(k);
        row.push({ key: k, count: inRange && c ? c.workout + c.run + c.walk : 0, inRange });
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [sessions]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {SINGLE_LETTER.map((l, i) => (
          <span key={i} className="text-[10px] text-fg/30 text-center">
            {l}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {weeks.map((row, r) => (
          <div key={r} className="grid grid-cols-7 gap-1">
            {row.map((cell) => (
              <div
                key={cell.key}
                title={`${cell.key}: ${cell.count} workout${cell.count === 1 ? "" : "s"}`}
                className="aspect-square rounded-sm"
                style={{
                  background: cell.inRange ? cellColor(cell.count) : "transparent",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
