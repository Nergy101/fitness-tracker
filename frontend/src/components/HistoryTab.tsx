import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon as ArrowLeft,
  ClockCounterClockwiseIcon as ClockCounterClockwise,
  SmileySadIcon as SmileySad,
  XIcon as X,
} from "@phosphor-icons/react";
import { api, type WorkoutSession, type WorkoutTemplate } from "../api";
import CalendarView from "./CalendarView";
import HistorySkeleton from "./skeletons/HistorySkeleton";
import DateRangeFilter from "./history/DateRangeFilter";
import DayBars from "./history/DayBars";
import HeatmapChart from "./history/HeatmapChart";
import ImportExport from "./history/ImportExport";
import SessionDetail from "./history/SessionDetail";
import SessionList from "./history/SessionList";
import StatsGrid from "./history/StatsGrid";
import WeekdayBarChart from "./history/WeekdayBarChart";
import { rangeStart, type RangeKey } from "./history/utils";

interface HistoryTabProps {
  refreshKey: number;
  onStartWorkout: (template: WorkoutTemplate) => void;
}

export default function HistoryTab({ refreshKey, onStartWorkout }: HistoryTabProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSession | null>(null);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>(() => {
    const stored = localStorage.getItem("history-range");
    return (stored as RangeKey) ?? "7d";
  });
  const [view, setView] = useState<"range" | "all">(() => {
    const stored = localStorage.getItem("history-view");
    return (stored as "range" | "all") ?? "range";
  });
  const [calendar, setCalendar] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getAllSessions()
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

  // Persist range/view selections to localStorage so they survive tab switches
  useEffect(() => { localStorage.setItem("history-range", range); }, [range]);
  useEffect(() => { localStorage.setItem("history-view", view); }, [view]);

  const rangeSessions = useMemo(() => {
    if (view === "all") return sessions;
    const start = rangeStart(range).getTime();
    return sessions.filter((s) => new Date(s.started_at).getTime() >= start);
  }, [sessions, range, view]);

  // Case-insensitive filter by exercise name (matches any exercise in a session).
  const searchedSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rangeSessions;
    return rangeSessions.filter((s) =>
      s.exercises.some((e) => e.exercise_name.toLowerCase().includes(q)),
    );
  }, [rangeSessions, search]);

  function updateSession(updated: WorkoutSession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleDelete(session: WorkoutSession) {
    try {
      await api.deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch {
      setError("Failed to delete session");
    }
  }

  if (loading) {
    return <HistorySkeleton />;
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

  const detailModal = detail && (
    <SessionDetail
      session={detail}
      onClose={() => setDetail(null)}
      onStartWorkout={onStartWorkout}
      onUpdate={(updated) => {
        setDetail(updated);
        updateSession(updated);
      }}
    />
  );

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
          <WeekdayBarChart sessions={sessions} />
        </div>

        <SessionList
          sessions={sessions}
          onSelect={setDetail}
          onEditDate={updateSession}
          onDelete={handleDelete}
          emptyLabel="No sessions yet"
        />

        {detailModal}
      </div>
    );
  }

  // ── Range view ─────────────────────────────────────────
  return (
    <div className="history-tab">
      <DateRangeFilter
        range={range}
        calendar={calendar}
        onRangeChange={(key) => {
          setRange(key);
          setCalendar(false);
        }}
        onToggleCalendar={() => setCalendar((c) => !c)}
      />

      {/* Activity + summary — chart depends on the mode. */}
      {calendar ? (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <CalendarView sessions={sessions} />
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <StatsGrid sessions={rangeSessions} />
          {range === "30d" ? (
            <HeatmapChart sessions={rangeSessions} />
          ) : (
            <DayBars sessions={rangeSessions} mode={range} />
          )}
        </div>
      )}

      {/* Done workouts in range */}
      <div className="relative mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by exercise..."
          className="w-full bg-surface border border-fg/10 rounded-xl pl-4 pr-9 py-2.5 text-sm text-fg outline-none focus:border-accent/50 placeholder:text-fg/20"
          aria-label="Search sessions by exercise"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/40 hover:text-fg/70"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>
      {search.trim() && (
        <p className="text-xs text-fg/40 mb-2">
          {searchedSessions.length} session{searchedSessions.length !== 1 ? "s" : ""} with{" "}
          &ldquo;{search.trim()}&rdquo;
        </p>
      )}

      <SessionList
        sessions={searchedSessions}
        onSelect={setDetail}
        onEditDate={updateSession}
        onDelete={handleDelete}
        emptyLabel="No workouts match that search."
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
      <ImportExport
        sessions={sessions}
        onImported={setSessions}
        onError={setError}
      />

      {detailModal}
    </div>
  );
}
