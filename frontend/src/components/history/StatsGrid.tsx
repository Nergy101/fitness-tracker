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
        <p className="text-lg font-bold text-fg">{stats.totalSessions}</p>
        <p className="text-[10px] text-fg/40">Workouts</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-fg">
          {formatHours(stats.totalMinutes)}
        </p>
        <p className="text-[10px] text-fg/40">Total Time</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-accent">
          {Math.round(stats.totalKcal)}
        </p>
        <p className="text-[10px] text-fg/40">Kcal</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-fg">
          {formatDuration(stats.avgDuration)}
        </p>
        <p className="text-[10px] text-fg/40">Avg</p>
      </div>
    </div>
  );
}
