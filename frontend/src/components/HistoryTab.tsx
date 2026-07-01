import { useEffect, useMemo, useState } from "react";
import { SmileySad } from "@phosphor-icons/react";
import { api, type WorkoutSession } from "../api";
import {
  formatDate,
  formatDateFull,
  formatDateRelative,
  formatDuration,
  formatHours,
} from "../format";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayBucket {
  label: string;
  count: number;
}

interface Stats {
  totalSessions: number;
  totalMinutes: number;
  totalKcal: number;
  avgDuration: number;
  weekDays: DayBucket[];
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

  const now = new Date();
  const weekDays: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const count = sessions.filter(
      (s) => new Date(s.started_at).toISOString().slice(0, 10) === dayStr,
    ).length;
    weekDays.push({ label: DAY_LABELS[d.getDay()], count: Math.min(count, 5) });
  }

  return { totalSessions, totalMinutes, totalKcal, avgDuration, weekDays };
}

interface HistoryTabProps {
  refreshKey: number;
}

export default function HistoryTab({ refreshKey }: HistoryTabProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getSessions()
      .then((data) => {
        if (active) setSessions(data);
      })
      .catch(() => {
        if (active) setError("Failed to load sessions");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const stats = useMemo(() => computeStats(sessions), [sessions]);

  return (
    <div className="history-tab">
      {!loading && sessions.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-fg">
                {stats.totalSessions}
              </p>
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

          <div className="flex items-end gap-1.5 h-16">
            {stats.weekDays.map((day, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${day.count * 20 + 4}px`,
                    background: day.count > 0 ? "var(--accent)" : "var(--track)",
                  }}
                />
                <span className="text-[10px] text-fg/30">{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-fg/40">Loading...</div>
      ) : error ? (
        <div className="flex flex-col items-center py-8 text-red-400">
          <SmileySad size={40} weight="regular" className="mb-3 opacity-80" />
          <p>{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-fg/40 text-lg mb-2">No sessions yet</p>
          <p className="text-fg/30 text-sm">
            Complete a workout to see your history here!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-surface rounded-xl p-4 border border-fg/5 cursor-pointer hover:border-accent/30 transition-colors"
              onClick={() => setDetail(session)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">
                    {session.template_name}
                  </h3>
                  <p className="text-xs text-fg/40 mt-0.5">
                    {formatDate(session.started_at)}
                  </p>
                </div>
                <span className="text-xs text-fg/30">
                  ~{Math.round(session.total_kcal_estimated)} kcal
                </span>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-fg/50">
                <span>{formatDuration(session.total_duration_seconds)}</span>
                <span>{session.exercises.length} exercises</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-fg/10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{detail.template_name}</h2>
              <button
                onClick={() => setDetail(null)}
                className="text-fg/40 hover:text-fg/70 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-fg">
                  {formatDuration(detail.total_duration_seconds)}
                </p>
                <p className="text-[10px] text-fg/40">Duration</p>
              </div>
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-fg">
                  {detail.exercises.length}
                </p>
                <p className="text-[10px] text-fg/40">Exercises</p>
              </div>
              <div className="bg-surface rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-accent">
                  {Math.round(detail.total_kcal_estimated)}
                </p>
                <p className="text-[10px] text-fg/40">Kcal</p>
              </div>
            </div>

            <p className="text-xs text-fg/40 mb-3">
              {formatDateFull(detail.started_at)}
            </p>

            <div className="space-y-1.5 mb-4">
              {detail.exercises.map((ex, i) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-3 bg-surface rounded-lg p-2.5"
                >
                  <span className="text-xs text-fg/30 w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ex.exercise_name}
                    </p>
                    <p className="text-xs text-fg/40">
                      {ex.duration_seconds}s
                    </p>
                  </div>
                  <span className="text-xs text-fg/30">
                    {Math.round(ex.kcal_burned)} kcal
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-fg/30 text-center">
              {formatDateRelative(detail.started_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
