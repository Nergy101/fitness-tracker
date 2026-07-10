import { useState } from "react";
import { api, type WorkoutSession } from "../../api";
import { formatDateRelative, formatDuration, localISO } from "../../format";

/** Modal showing a session's stats, per-exercise breakdown, date editing, and inline notes. */
export default function SessionDetail({
  session,
  onClose,
  onUpdate,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onUpdate: (updated: WorkoutSession) => void;
}) {
  const [notes, setNotes] = useState(session.notes || "");

  function toLocalDatetimeLocal(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function updateStartedAt(value: string) {
    try {
      const updated = await api.updateSession(session.id, {
        started_at: localISO(value),
      });
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update session date", err);
    }
  }

  async function saveNotes() {
    const trimmed = notes.trim();
    if (trimmed === (session.notes || "")) return;
    try {
      const updated = await api.updateSession(session.id, { notes: trimmed });
      onUpdate(updated);
      setNotes(trimmed);
    } catch (err) {
      console.error("Failed to save notes", err);
    }
  }

  const isRunOrWalk = session.template_name.startsWith("Run:") || session.template_name.startsWith("Walk:");
  const isRun = session.template_name.startsWith("Run:");

  async function toggleRunType() {
    try {
      const runs = await api.getRuns();
      const distMatch = session.template_name.match(/(\d+\.\d+)km/);
      const targetDist = distMatch ? parseFloat(distMatch[1]) : null;
      const match = runs.find((r) => {
        if (targetDist !== null && Math.abs(r.distance_km - targetDist) > 0.05) return false;
        return r.run_type === (isRun ? "run" : "walk");
      });
      if (match) {
        await api.updateRun(match.id, {
          duration_seconds: match.duration_seconds,
          distance_km: match.distance_km,
          run_type: isRun ? "walk" : "run",
        });
        const updated = await api.getSession(session.id);
        onUpdate(updated);
      }
    } catch (err) {
      console.error("Failed to toggle run type", err);
    }
  }

  const notesDirty = notes.trim() !== (session.notes || "");

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

        <div className="bg-surface rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-fg/40 font-medium">Notes</p>
            {notesDirty && (
              <button
                onClick={saveNotes}
                className="text-[10px] text-accent font-medium hover:underline"
              >
                Save
              </button>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes..."
            aria-label="Session notes"
            rows={3}
            className="w-full bg-transparent text-sm text-fg placeholder:text-fg/25 outline-none resize-none"
          />
        </div>

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

        {isRunOrWalk && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={toggleRunType}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                isRun ? "bg-accent text-on-accent font-semibold" : "bg-surface border border-fg/10 text-fg/50"
              }`}
            >
              Run
            </button>
            <button
              onClick={toggleRunType}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                !isRun ? "bg-accent text-on-accent font-semibold" : "bg-surface border border-fg/10 text-fg/50"
              }`}
            >
              Walk
            </button>
          </div>
        )}

        <p className="text-xs text-fg/30 text-center">
          {formatDateRelative(session.started_at)}
        </p>
      </div>
    </div>
  );
}