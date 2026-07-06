import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon as ArrowLeft,
  ClockCounterClockwiseIcon as ClockCounterClockwise,
  DownloadSimpleIcon as DownloadSimple,
  PersonSimpleRunIcon as PersonSimpleRun,
  SmileySadIcon as SmileySad,
  UploadSimpleIcon as UploadSimple,
  CalendarBlankIcon as CalendarBlank,
} from "@phosphor-icons/react";
import {
  api,
  type SessionExerciseInput,
  type WorkoutSession,
  type WorkoutSessionInput,
} from "../api";
import {
  formatDate,
  formatDateRelative,
  formatDuration,
  formatHours,
} from "../format";
import { shortDate } from "../locale";
import { useLocale } from "../useLocale";
import CalendarView from "./CalendarView";

// Bump when the export shape changes so future imports can migrate old files.
const HISTORY_EXPORT_VERSION = 1;

// Monday-first weekday labels; map JS getDay() (0=Sun) via (day + 6) % 7.
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type RangeKey = "week" | "7d" | "30d";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function rangeStart(key: RangeKey): Date {
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

function StatsGrid({ sessions }: { sessions: WorkoutSession[] }) {
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

/** Bars per weekday (Mon–Sun) showing how many workouts landed on each day. */
function WeekdayChart({ sessions }: { sessions: WorkoutSession[] }) {
  const buckets = useMemo(() => {
    const counts = new Array(7).fill(0);
    for (const s of sessions) {
      const day = new Date(s.started_at).getDay(); // 0=Sun
      counts[(day + 6) % 7]++;
    }
    return counts;
  }, [sessions]);
  const max = Math.max(1, ...buckets);

  return (
    <div className="flex items-end gap-1.5 h-20">
      {buckets.map((count, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <span
            className={`text-[10px] font-semibold ${count > 0 ? "text-accent" : "text-transparent"}`}
          >
            {count}
          </span>
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${count > 0 ? 6 + (count / max) * 46 : 3}px`,
              background: count > 0 ? "var(--accent)" : "var(--track)",
            }}
          />
          <span className="text-[10px] text-fg/30">{WEEKDAY_LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Local-time YYYY-MM-DD key (avoids UTC off-by-one at day boundaries).
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countsByDay(sessions: WorkoutSession[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.started_at));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

const SINGLE_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/** Per-date bars with weekday letter + short date underneath. "week" shows
 *  Mon–Sun of the current week; "7d" shows a rolling window ending today
 *  (today rightmost). */
function DayBars({
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
    const items: { key: string; count: number; label: string; date: Date }[] = [];
    if (mode === "week") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        items.push({ key: dayKey(d), count: byDay.get(dayKey(d)) ?? 0, label: SINGLE_LETTER[i], date: d });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        items.push({
          key: dayKey(d),
          count: byDay.get(dayKey(d)) ?? 0,
          label: SINGLE_LETTER[(d.getDay() + 6) % 7],
          date: d,
        });
      }
    }
    return { items, todayKey: dayKey(now) };
  }, [sessions, mode]);
  const max = Math.max(1, ...days.items.map((d) => d.count));

  return (
    <div className="flex items-end gap-1.5 h-24">
      {days.items.map((d) => {
        const today = d.key === days.todayKey;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5">
            <span
              className={`text-[10px] font-semibold ${d.count > 0 ? "text-accent" : "text-transparent"}`}
            >
              {d.count}
            </span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${d.count > 0 ? 6 + (d.count / max) * 40 : 3}px`,
                background: d.count > 0 ? "var(--accent)" : "var(--track)",
              }}
            />
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
  );
}

// GitHub-style intensity: transparent-ish → full accent as count rises.
function cellColor(count: number): string {
  if (count <= 0) return "var(--track)";
  const pct = [45, 65, 85, 100][Math.min(count - 1, 3)];
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

/** 30-day contribution heatmap: columns = weekdays (Mon–Sun), rows = weeks,
 *  latest week at the bottom. Weekday letters label the columns. */
function Heatmap({ sessions }: { sessions: WorkoutSession[] }) {
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
        row.push({ key: k, count: inRange ? byDay.get(k) ?? 0 : 0, inRange });
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

function SessionList({
  sessions,
  onSelect,
  emptyLabel,
}: {
  sessions: WorkoutSession[];
  onSelect: (s: WorkoutSession) => void;
  emptyLabel: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 text-fg/30 text-sm">{emptyLabel}</div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-surface rounded-xl p-4 border border-fg/5 cursor-pointer hover:border-accent/30 transition-colors"
          onClick={() => onSelect(session)}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {session.template_name.startsWith("Run:") && (
                  <PersonSimpleRun size={16} className="text-accent shrink-0" />
                )}
                <h3 className="font-semibold text-sm">{session.template_name}</h3>
              </div>
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
  );
}

function SessionDetail({
  session,
  onClose,
  onUpdate,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onUpdate: (updated: WorkoutSession) => void;
}) {
  function toLocalDatetimeLocal(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function updateStartedAt(value: string) {
    try {
      const updated = await api.updateSession(session.id, {
        started_at: new Date(value).toISOString(),
      });
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update session date", err);
    }
  }
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-fg/10 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{session.template_name}</h2>
          <button
            onClick={onClose}
            className="text-fg/40 hover:text-fg/70 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-fg">
              {formatDuration(session.total_duration_seconds)}
            </p>
            <p className="text-[10px] text-fg/40">Duration</p>
          </div>
          <div className="bg-surface rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-fg">
              {session.exercises.length}
            </p>
            <p className="text-[10px] text-fg/40">Exercises</p>
          </div>
          <div className="bg-surface rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-accent">
              {Math.round(session.total_kcal_estimated)}
            </p>
            <p className="text-[10px] text-fg/40">Kcal</p>
          </div>
        </div>

        <p className="text-xs text-fg/40 mb-3">
          <input
            type="datetime-local"
            defaultValue={toLocalDatetimeLocal(session.started_at)}
            onBlur={(e) => updateStartedAt(e.target.value)}
            className="w-full bg-surface border border-fg/10 rounded-lg px-3 py-1.5 text-xs text-fg outline-none focus:border-accent/50"
          />
        </p>

        <div className="space-y-1.5 mb-4">
          {session.exercises.map((ex, i) => (
            <div
              key={ex.id}
              className="flex items-center gap-3 bg-surface rounded-lg p-2.5"
            >
              <span className="text-xs text-fg/30 w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {ex.exercise_name}
                </p>
                <p className="text-xs text-fg/40">{ex.duration_seconds}s</p>
                {ex.logs && ex.logs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ex.logs.map((log, li) => (
                      <span key={li} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                        {log.weight_kg != null ? `${log.weight_kg}kg` : ""}
                        {log.weight_kg != null && log.reps != null ? " × " : ""}
                        {log.reps != null ? `${log.reps}r` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-fg/30">
                {Math.round(ex.kcal_burned)} kcal
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-fg/30 text-center">
          {formatDateRelative(session.started_at)}
        </p>
      </div>
    </div>
  );
}

// Convert one raw imported object into a session payload, tolerating partial
// data (external JSON is untrusted). Returns null when it isn't session-shaped.
function toSessionInput(raw: unknown): WorkoutSessionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.template_name !== "string") return null;

  const exercisesRaw = Array.isArray(o.exercises) ? o.exercises : [];
  const exercises: SessionExerciseInput[] = exercisesRaw.map((e, i) => {
    const ex = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    return {
      exercise_id: typeof ex.exercise_id === "number" ? ex.exercise_id : null,
      exercise_name: typeof ex.exercise_name === "string" ? ex.exercise_name : "",
      duration_seconds: typeof ex.duration_seconds === "number" ? ex.duration_seconds : 0,
      kcal_burned: typeof ex.kcal_burned === "number" ? ex.kcal_burned : 0,
      order_index: typeof ex.order_index === "number" ? ex.order_index : i,
      completed: ex.completed !== false,
    };
  });

  return {
    template_id: typeof o.template_id === "number" ? o.template_id : null,
    template_name: o.template_name,
    total_duration_seconds:
      typeof o.total_duration_seconds === "number" ? o.total_duration_seconds : 0,
    total_kcal_estimated:
      typeof o.total_kcal_estimated === "number" ? o.total_kcal_estimated : 0,
    exercises,
    started_at: typeof o.started_at === "string" ? o.started_at : null,
    finished_at: typeof o.finished_at === "string" ? o.finished_at : null,
  };
}

interface HistoryTabProps {
  refreshKey: number;
}

export default function HistoryTab({ refreshKey }: HistoryTabProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSession | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [view, setView] = useState<"range" | "all">("range");
  const [calendar, setCalendar] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const rangeSessions = useMemo(() => {
    if (view === "all") return sessions;
    const start = rangeStart(range).getTime();
    return sessions.filter((s) => new Date(s.started_at).getTime() >= start);
  }, [sessions, range, view]);

  function exportSessions() {
    const payload = {
      version: HISTORY_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitness-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSessions(file: File) {
    setImporting(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      // Accept the versioned envelope { version, sessions: [...] } or a bare
      // array (pre-versioning exports).
      let rows: unknown[] = [];
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === "object") {
        const env = parsed as Record<string, unknown>;
        if (Array.isArray(env.sessions)) rows = env.sessions;
      }
      const payloads = rows
        .map(toSessionInput)
        .filter((p): p is WorkoutSessionInput => p !== null);
      if (payloads.length === 0) {
        setError("No valid sessions found in that file.");
        return;
      }
      for (const p of payloads) {
        await api.createSession(p);
      }
      setSessions(await api.getSessions());
    } catch {
      setError("Could not import that file.");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-fg/40">Loading...</div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center py-8 text-red-400">
        <SmileySad size={40} weight="regular" className="mb-3 opacity-80" />
        <p>{error}</p>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-fg/40 text-lg mb-2">No sessions yet</p>
        <p className="text-fg/30 text-sm">
          Complete a workout to see your history here!
        </p>
      </div>
    );
  }

  // ── All-time view ──────────────────────────────────────
  if (view === "all") {
    return (
      <div className="history-tab">
        <button
          onClick={() => setView("range")}
          className="flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg mb-4 transition-colors"
        >
          <ArrowLeft size={16} weight="bold" /> Back
        </button>

        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <p className="text-sm font-semibold mb-3">All time</p>
          <StatsGrid sessions={sessions} />
          <WeekdayChart sessions={sessions} />
        </div>

        <SessionList
          sessions={sessions}
          onSelect={setDetail}
          emptyLabel="No sessions yet"
        />

        {detail && (
          <SessionDetail session={detail} onClose={() => setDetail(null)} onUpdate={(updated) => { setDetail(updated); setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s)); }} />
        )}
      </div>
    );
  }

  // ── Range view ─────────────────────────────────────────
  return (
    <div className="history-tab">
      {/* Look-back range selector */}
      <div className="flex gap-2 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setRange(r.key); setCalendar(false); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              range === r.key && !calendar
                ? "bg-accent text-on-accent"
                : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setCalendar(!calendar)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            calendar
              ? "bg-accent text-on-accent"
              : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
          }`}
        >
          <CalendarBlank size={16} className="inline mr-1" />
          Calendar
        </button>
      </div>

      {/* Activity + summary — chart depends on the mode. */}
      {calendar ? (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <CalendarView sessions={rangeSessions} />
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <StatsGrid sessions={rangeSessions} />
          {range === "30d" ? (
            <Heatmap sessions={rangeSessions} />
          ) : (
            <DayBars sessions={rangeSessions} mode={range} />
          )}
        </div>
      )}

      {/* Done workouts in range */}
      <SessionList
        sessions={rangeSessions}
        onSelect={setDetail}
        emptyLabel="No workouts in this range."
      />

      {/* View all → all-time */}
      <button
        onClick={() => setView("all")}
        className="w-full mt-4 flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors"
      >
        View all
        <ClockCounterClockwise size={16} weight="bold" />
      </button>

      {/* Import / export all history as JSON */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors disabled:opacity-50"
        >
          <UploadSimple size={16} weight="bold" />
          {importing ? "Importing..." : "Import"}
        </button>
        <button
          onClick={exportSessions}
          disabled={sessions.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors disabled:opacity-50"
        >
          <DownloadSimple size={16} weight="bold" />
          Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importSessions(file);
            e.target.value = ""; // allow re-importing the same file
          }}
        />
      </div>

      {detail && (
        <SessionDetail session={detail} onClose={() => setDetail(null)} onUpdate={(updated) => { setDetail(updated); setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s)); }} />
      )}
    </div>
  );
}
