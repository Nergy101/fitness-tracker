import { useEffect, useState } from "react";
import { CheckCircle, SmileySad, Timer, MapTrifold } from "@phosphor-icons/react";
import {
  api,
  type Exercise,
  type WorkoutTemplate,
  type RunEntryResponse,
  type RunStatsResponse,
} from "../api";
import { formatDuration } from "../format";
import WorkoutEditor from "./WorkoutEditor";

interface WorkoutTabProps {
  onStartWorkout: (workout: WorkoutTemplate) => void;
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

export default function WorkoutTab({ onStartWorkout }: WorkoutTabProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Run logging state
  const [showRunForm, setShowRunForm] = useState(false);
  const [runDuration, setRunDuration] = useState(1800);
  const [runCustomDuration, setRunCustomDuration] = useState("");
  const [runDistance, setRunDistance] = useState("");
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [runNotes, setRunNotes] = useState("");
  const [recentRuns, setRecentRuns] = useState<RunEntryResponse[]>([]);
  const [runStats, setRunStats] = useState<RunStatsResponse | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    Promise.all([api.getWorkouts(), api.getExercises(), api.getRuns(), api.getRunStats()])
      .then(([tpls, exs, runs, stats]) => {
        setTemplates(tpls);
        setAllExercises(exs);
        setRecentRuns(runs);
        setRunStats(stats);
      })
      .catch(() => setError("Failed to load workouts"))
      .finally(() => setLoading(false));
  }, []);

  function openEditor(tpl: WorkoutTemplate | null) {
    setEditing(tpl);
    setShowEditor(true);
  }

  async function onSave() {
    const wasEditing = Boolean(editing);
    setShowEditor(false);
    setLoading(true);
    try {
      setTemplates(await api.getWorkouts());
      setToast(wasEditing ? "Workout updated" : "Workout created");
    } finally {
      setLoading(false);
    }
  }

  async function logRun() {
    const dist = parseFloat(runDistance);
    const dur = runDuration;
    if (isNaN(dist) || dist <= 0 || dur <= 0) return;

    await api.createRun({
      duration_seconds: dur,
      distance_km: dist,
      date: runDate,
      notes: runNotes,
    });

    setToast("Run logged! 🏃");
    setRunDistance("");
    setRunNotes("");
    setRunCustomDuration("");
    setRunDuration(1800);
    setShowRunForm(false);

    const [runs, stats] = await Promise.all([api.getRuns(), api.getRunStats()]);
    setRecentRuns(runs);
    setRunStats(stats);
  }

  function deleteRun(id: number) {
    api.deleteRun(id).then(() => {
      Promise.all([api.getRuns(), api.getRunStats()]).then(([runs, stats]) => {
        setRecentRuns(runs);
        setRunStats(stats);
      });
    });
  }

  const pace = runDuration > 0 && parseFloat(runDistance) > 0
    ? runDuration / parseFloat(runDistance)
    : null;

  return (
    <div className="workout-tab">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] flex items-center gap-2 bg-accent text-on-accent rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg"
        >
          <CheckCircle size={18} weight="fill" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm text-fg/50 font-medium">My Workouts</h2>
        <button
          onClick={() => openEditor(null)}
          className="bg-accent text-on-accent rounded-xl px-4 py-2 text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          + New Workout
        </button>
      </div>

      {/* ─── Log a Run Card ─────────────────────────────── */}

      {!showRunForm ? (
        <button
          onClick={() => setShowRunForm(true)}
          className="w-full bg-surface rounded-xl p-4 border border-fg/5 border-dashed hover:border-accent/30 transition-colors mb-4 flex items-center gap-3"
        >
          <Timer size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Log a Run</p>
            <p className="text-[11px] text-fg/40 mt-0.5">Record a completed run with distance, duration, and pace</p>
          </div>
        </button>
      ) : (
        <div className="bg-surface rounded-xl p-4 border border-accent/20 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-accent" />
              <span className="text-sm font-semibold text-white">Log a Run</span>
            </div>
            <button onClick={() => setShowRunForm(false)} className="text-xs text-fg/40 hover:text-white">Cancel</button>
          </div>

          {/* Duration quick-select */}
          <div>
            <p className="text-xs text-fg/50 mb-1.5">Duration</p>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setRunDuration(opt.seconds);
                    setRunCustomDuration("");
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    runDuration === opt.seconds && !runCustomDuration
                      ? "bg-accent text-bg font-semibold"
                      : "bg-bg text-fg/60 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {runDuration === 0 && (
              <input
                type="number"
                value={runCustomDuration}
                onChange={(e) => {
                  setRunCustomDuration(e.target.value);
                  setRunDuration(parseInt(e.target.value) || 0);
                }}
                placeholder="Seconds"
                className="mt-2 w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-fg/50 mb-1">Distance (km)</p>
              <input
                type="number"
                step="0.1"
                value={runDistance}
                onChange={(e) => setRunDistance(e.target.value)}
                placeholder="e.g. 5.0"
                className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <p className="text-xs text-fg/50 mb-1">Date</p>
              <input
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Pace preview */}
          {pace && pace > 0 && (
            <div className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
              <MapTrifold size={16} className="text-accent" />
              <span className="text-fg/60">Pace:</span>
              <span className="text-white font-semibold">{formatPace(pace)}</span>
              <span className="text-fg/40 text-xs ml-auto">
                {formatDuration(runDuration)} · {parseFloat(runDistance).toFixed(1)}km
              </span>
            </div>
          )}

          <div>
            <p className="text-xs text-fg/50 mb-1">Notes (optional)</p>
            <input
              type="text"
              value={runNotes}
              onChange={(e) => setRunNotes(e.target.value)}
              placeholder="How did it feel?"
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
            />
          </div>

          <button
            onClick={logRun}
            disabled={!runDistance || parseFloat(runDistance) <= 0}
            className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save Run
          </button>
        </div>
      )}

      {/* ─── Run Stats ──────────────────────────────────── */}

      {runStats && runStats.total_runs > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer size={16} className="text-accent" />
            <span className="text-xs text-fg/50 font-medium">Running Stats</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{runStats.total_runs}</p>
              <p className="text-[10px] text-fg/40">Runs</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{runStats.total_distance_km.toFixed(0)}</p>
              <p className="text-[10px] text-fg/40">Total km</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{formatPace(runStats.avg_pace_per_km)}</p>
              <p className="text-[10px] text-fg/40">Avg pace</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-accent">{formatDuration(runStats.total_duration_seconds)}</p>
              <p className="text-[10px] text-fg/40">Total time</p>
            </div>
          </div>
          {runStats.longest_run_distance_km && (
            <p className="text-xs text-fg/40">
              Longest run: {runStats.longest_run_distance_km.toFixed(1)}km · Best 5k: {runStats.fastest_5k_seconds ? formatPace(runStats.fastest_5k_seconds * 5) : "—"}
            </p>
          )}
        </div>
      )}

      {/* ─── Recent Runs ────────────────────────────────── */}

      {recentRuns.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-fg/50 font-medium">Recent Runs</p>
          {recentRuns.slice(0, 5).map((run) => {
            const p = run.pace_per_km;
            return (
              <div key={run.id} className="bg-surface rounded-xl p-3 border border-fg/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Timer size={18} className="text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {run.distance_km.toFixed(1)}km · {formatDuration(run.duration_seconds)}
                    </p>
                    <p className="text-xs text-fg/40">
                      Pace {formatPace(p)}
                      {run.notes && ` · ${run.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-fg/30">{run.date.slice(5)}</span>
                  <button onClick={() => deleteRun(run.id)} className="text-red-400/40 hover:text-red-400 text-xs">del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Workout Templates ──────────────────────────── */}

      {loading ? (
        <div className="text-center py-8 text-fg/40">Loading...</div>
      ) : error ? (
        <div className="flex flex-col items-center py-12 text-red-400">
          <SmileySad size={40} weight="regular" className="mb-3 opacity-80" />
          <p>{error}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-fg/40 text-lg mb-2">No workout templates yet</p>
          <p className="text-fg/30 text-sm mb-6">
            Create your first timed workout!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-surface rounded-xl p-4 border border-fg/5"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onStartWorkout(tpl)}
                >
                  <h3 className="font-semibold text-base">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-fg/50 text-sm mt-1">
                      {tpl.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-fg/40">
                    <span>{tpl.exercises.length} exercises</span>
                    {tpl.rounds > 1 && <span>{tpl.rounds} rounds</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs">
                    <span className="text-fg/50">
                      Work <span className="font-semibold text-fg/70">{formatDuration(tpl.work_duration_seconds)}</span>
                    </span>
                    {tpl.rest_duration_seconds > 0 && (
                      <span className="text-fg/50">
                        Rest{" "}
                        <span className="font-semibold text-fg/70">
                          {tpl.rounds - 1}&times;{formatDuration(tpl.rest_between_rounds)}
                        </span>
                      </span>
                    )}
                    <span className="text-accent">
                      Total <span className="font-semibold">{formatDuration(tpl.total_duration_seconds)}</span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => openEditor(tpl)}
                    className="text-fg/30 hover:text-fg/70 transition-colors p-1"
                    title="Edit"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onStartWorkout(tpl)}
                    className="bg-accent/20 text-accent rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-accent/30 transition-colors"
                  >
                    Start
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <WorkoutEditor
          workout={editing}
          exercises={allExercises}
          onSave={onSave}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
