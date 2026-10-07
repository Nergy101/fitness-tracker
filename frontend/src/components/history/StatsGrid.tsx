import type { WorkoutSession } from "../../api";
import { formatDuration, formatHours } from "../../format";

interface Stats {
  totalSessions: number;
  totalMinutes: number;
  totalKcal: number;
  avgDuration: number;
}

function computeStats(sessions: WorkoutSession[]): Stats {
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce(
    (s, i) => s + Math.round((i.total_duration_seconds || 0) / 60),
    0,
  );
  const totalKcal = sessions.reduce(
    (s, i) => s + (i.total_kcal_estimated || 0),
    0,
  );
  const avgDuration =
    totalSessions > 0 ? Math.round(totalMinutes / totalSessions) * 60 : 0;
  return { totalSessions, totalMinutes, totalKcal, avgDuration };
}

export default function StatsGrid({ sessions }: { sessions: WorkoutSession[] }) {
  const stats = computeStats(sessions);
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight tabular-nums text-fg">{stats.totalSessions}</p>
        <p className="text-[10px] font-semibold tracking-wide text-fg/45 mt-0.5">Workouts</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight tabular-nums text-fg">
          {formatHours(stats.totalMinutes)}
        </p>
        <p className="text-[10px] font-semibold tracking-wide text-fg/45 mt-0.5">Total Time</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight tabular-nums text-accent">
          {Math.round(stats.totalKcal)}
        </p>
        <p className="text-[10px] font-semibold tracking-wide text-fg/45 mt-0.5">Kcal</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight tabular-nums text-fg">
          {formatDuration(stats.avgDuration)}
        </p>
        <p className="text-[10px] font-semibold tracking-wide text-fg/45 mt-0.5">Avg</p>
      </div>
    </div>
  );
}
