import { useEffect, useState } from "react";
import { api, type WorkoutSession, type BoxingEntryResponse } from "../../api";
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

  const isBoxing = session.template_name.startsWith("Boxing:");
  const [boxingEntry, setBoxingEntry] = useState<BoxingEntryResponse | null>(null);
  const [boxMinutes, setBoxMinutes] = useState("");
  const [boxKcalPerMin, setBoxKcalPerMin] = useState("");
  const [boxRounds, setBoxRounds] = useState("");

  useEffect(() => {
    if (!isBoxing || session.boxing_entry_id == null) return;
    let active = true;
    api
      .getBoxing()
      .then((list) => {
        if (!active) return;
        const e = list.find((b) => b.id === session.boxing_entry_id);
        if (e) {
          setBoxingEntry(e);
          setBoxMinutes(String(Math.round(e.duration_seconds / 60)));
          setBoxKcalPerMin(String(e.kcal_per_min));
          setBoxRounds(e.rounds != null ? String(e.rounds) : "");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isBoxing, session.boxing_entry_id]);

  async function saveBoxing() {
    if (!boxingEntry) return;
    const mins = parseInt(boxMinutes) || 0;
    if (mins <= 0) return;
    try {
      await api.updateBoxing(boxingEntry.id, {
        duration_seconds: mins * 60,
        kcal_per_min: parseFloat(boxKcalPerMin) || 0,
        rounds: boxRounds ? parseInt(boxRounds) : null,
        date: boxingEntry.date.slice(0, 10),
        notes: boxingEntry.notes,
      });
      const [updated, list] = await Promise.all([
        api.getSession(session.id),
        api.getBoxing(),
      ]);
      onUpdate(updated);
      const e = list.find((b) => b.id === boxingEntry.id);
      if (e) setBoxingEntry(e);
    } catch (err) {
      console.error("Failed to update boxing session", err);
    }
  }

  const boxDirty =
    !!boxingEntry &&
    ((parseInt(boxMinutes) || 0) * 60 !== boxingEntry.duration_seconds ||
      (parseFloat(boxKcalPerMin) || 0) !== boxingEntry.kcal_per_min ||
      (boxRounds ? parseInt(boxRounds) : null) !== (boxingEntry.rounds ?? null));

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

        {isBoxing && boxingEntry && (
          <div className="bg-surface rounded-lg p-3 mb-4 space-y-3">
            <p className="text-[10px] text-fg/40 font-medium">Edit boxing session</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-fg/40 mb-1">Minutes</p>
                <input
                  type="number"
                  min="1"
                  value={boxMinutes}
                  onChange={(e) => setBoxMinutes(e.target.value)}
                  aria-label="Boxing minutes"
                  className="w-full bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <p className="text-[10px] text-fg/40 mb-1">Kcal/min</p>
                <input
                  type="number"
                  step="0.1"
                  value={boxKcalPerMin}
                  onChange={(e) => setBoxKcalPerMin(e.target.value)}
                  aria-label="Boxing kcal per minute"
                  className="w-full bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <p className="text-[10px] text-fg/40 mb-1">Rounds</p>
                <input
                  type="number"
                  min="1"
                  value={boxRounds}
                  onChange={(e) => setBoxRounds(e.target.value)}
                  placeholder="—"
                  aria-label="Boxing rounds"
                  className="w-full bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </div>
            </div>
            {boxDirty && (
              <button
                onClick={saveBoxing}
                disabled={(parseInt(boxMinutes) || 0) <= 0}
                className="w-full bg-accent text-on-accent rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Save changes
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-fg/30 text-center">
          {formatDateRelative(session.started_at)}
        </p>
      </div>
    </div>
  );
}