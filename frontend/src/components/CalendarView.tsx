import { useMemo, useState } from "react";
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  ArrowClockwiseIcon as ArrowClockwise,
  XIcon as X,
} from "@phosphor-icons/react";
import type { WorkoutSession } from "../api";
import { formatDuration } from "../format";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, activityKind, type ActivityKind } from "../activity";
import { dayKey } from "../dateKey";

// ─── Helpers ──────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarDay {
  key: string;
  day: number;
  date: Date;
  inMonth: boolean;
  sessions: WorkoutSession[];
  totalMinutes: number;
}

// ─── Calendar Component ──────────────────────────────────

interface CalendarViewProps {
  sessions: WorkoutSession[];
}

export default function CalendarView({ sessions }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // Build lookup: date key -> sessions
  const byDay = useMemo(() => {
    const m = new Map<string, WorkoutSession[]>();
    for (const s of sessions) {
      const d = new Date(s.started_at);
      // Use local date
      const k = dayKey(d);
      const arr = m.get(k) ?? [];
      arr.push(s);
      m.set(k, arr);
    }
    return m;
  }, [sessions]);

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from Monday on or before the 1st
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

    const rows: CalendarDay[][] = [];
    const cursor = new Date(start);

    while (cursor <= lastDay || (rows.length > 0 && rows[rows.length - 1].length < 7)) {
      const row: CalendarDay[] = [];
      for (let i = 0; i < 7; i++) {
        const k = dayKey(cursor);
        const daySessions = byDay.get(k) ?? [];
        const totalMinutes = daySessions.reduce(
          (s, sess) => s + Math.round((sess.total_duration_seconds || 0) / 60), 0
        );
        row.push({
          key: k,
          day: cursor.getDate(),
          date: new Date(cursor),
          inMonth: cursor.getMonth() === month,
          sessions: daySessions,
          totalMinutes,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [viewDate, byDay]);

  const todayKey = dayKey(new Date());

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };
  const jumpToday = () => {
    setViewDate(new Date());
    setSelectedDay(null);
  };

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-field text-fg/60 hover:text-fg hover:bg-track transition-colors"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <h3 className="text-sm font-bold tracking-tight">
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={jumpToday}
            aria-label="Jump to current month"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-field text-fg/50 hover:text-fg hover:bg-track transition-colors"
          >
            <ArrowClockwise size={18} />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-field text-fg/60 hover:text-fg hover:bg-track transition-colors"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((l) => (
          <span key={l} className="text-[10px] font-semibold tracking-wide text-fg/45 text-center py-1">
            {l}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex flex-col gap-1">
        {weeks.map((row, r) => (
          <div key={r} className="grid grid-cols-7 gap-1">
            {row.map((cell) => {
              const isToday = cell.key === todayKey;
              const hasWorkout = cell.sessions.length > 0;
              const dayKinds = cell.sessions.reduce<ActivityKind[]>((kinds, session) => {
                const kind = activityKind(session.template_name);
                return kinds.includes(kind) ? kinds : [...kinds, kind];
              }, []);
              const dayKind = dayKinds[0] ?? null;
              return (
                <button
                  key={cell.key}
                  onClick={() => cell.inMonth && hasWorkout && setSelectedDay(cell)}
                  disabled={!cell.inMonth}
                  className={`
                    relative flex flex-col items-center justify-center rounded-xl p-1 min-h-[44px] transition-all text-xs
                    ${!cell.inMonth ? "opacity-20" : hasWorkout ? "hover:opacity-80 cursor-pointer" : ""}
                    ${isToday ? "ring-2 ring-fg/70" : ""}
                    ${selectedDay?.key === cell.key ? "ring-2 ring-accent shadow-[var(--shadow-sm)]" : ""}
                  `}
                  style={dayKinds.length === 1 ? { backgroundColor: `var(--tint-${dayKind}-bg)` } : undefined}
                >
                  <span className={`text-xs tabular-nums ${hasWorkout ? "font-bold" : isToday ? "text-fg font-bold" : "text-fg/70 font-medium"}`} style={dayKinds.length === 1 ? { color: `var(--tint-${dayKind}-fg)` } : undefined}>
                    {cell.day}
                  </span>
                  {hasWorkout && (
                    <div className="flex gap-0.5 mt-0.5">
                      {cell.sessions.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: ACTIVITY_COLORS[activityKind(s.template_name)] }}
                        />
                      ))}
                    </div>
                  )}
                  {cell.totalMinutes > 0 && (
                    <span className="text-[9px] tabular-nums text-fg/60 mt-0.5">
                      {cell.totalMinutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <DayDetail
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────

function DayDetail({
  day,
  onClose,
}: {
  day: CalendarDay;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 bg-bg rounded-[22px] p-4 border border-fg/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold tracking-tight">
          {day.date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h4>
        <button
          onClick={onClose}
          aria-label="Close day details"
          className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-fg/50 hover:text-fg hover:bg-fg/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {day.sessions.map((session) => {
          const kind = activityKind(session.template_name);
          const KindIcon = ACTIVITY_ICONS[kind];
          return (
          <div
            key={session.id}
            className="bg-surface rounded-[22px] p-3 border border-fg/[0.06]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `var(--tint-${kind}-bg)`, color: `var(--tint-${kind}-fg)` }}>
                    <KindIcon size={16} />
                  </span>
                  {session.template_name}
                </p>
                <p className="text-xs text-fg/40 mt-0.5">
                  {new Date(session.started_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="text-xs text-fg/30">
                {Math.round(session.total_kcal_estimated)} kcal
              </span>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-fg/50">
              <span>{formatDuration(session.total_duration_seconds)}</span>
              <span>{session.exercises.length} exercises</span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
