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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <div className="min-h-[76px] rounded-[22px] bg-[var(--tint-workout-bg)] text-[var(--tint-workout-fg)] p-3 flex flex-col justify-between">
        <p className="text-xs font-semibold">Sessions</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums">{stats.totalSessions}</p>
      </div>
      <div className="min-h-[76px] rounded-[22px] bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)] p-3 flex flex-col justify-between">
        <p className="text-xs font-semibold">Total time</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatHours(stats.totalMinutes)}</p>
      </div>
      <div className="min-h-[76px] rounded-[22px] bg-[var(--tint-run-bg)] text-[var(--tint-run-fg)] p-3 flex flex-col justify-between">
        <p className="text-xs font-semibold">Active kcal</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums">{Math.round(stats.totalKcal).toLocaleString()}</p>
      </div>
      <div className="min-h-[76px] rounded-[22px] bg-[var(--tint-walk-bg)] text-[var(--tint-walk-fg)] p-3 flex flex-col justify-between">
        <p className="text-xs font-semibold">Avg session</p>
        <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatDuration(stats.avgDuration)}</p>
      </div>
    </div>
  );
}
