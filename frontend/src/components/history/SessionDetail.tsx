import { useEffect, useRef, useState } from "react";
import { PlayCircleIcon as PlayCircle } from "@phosphor-icons/react";
import { api, type WorkoutSession, type BoxingEntryResponse, type RunEntryResponse, type WorkoutTemplate } from "../../api";
import { formatDateRelative, formatDuration, localISO } from "../../format";
import { useFocusTrap } from "../../useFocusTrap";
import ExerciseImage from "../ExerciseImage";

import { logger } from "../../logger";

/** Build a startable WorkoutTemplate from a past session's exercises so the
 * user can repeat the workout without recreating it by hand. */
function sessionToTemplate(session: WorkoutSession): WorkoutTemplate {
  return {
    id: 0,
    name: session.template_name,
    description: "",
    mode: "circuit",
    time_cap_seconds: null,
    rounds: 1,
    rest_between_rounds: 180,
    is_pinned: false,
    pinned_order: null,
    warmup_seconds: 0,
    cooldown_seconds: 0,
    created_at: session.started_at,
    exercises: session.exercises.map((se, i) => ({
      id: se.id,
      template_id: 0,
      exercise_id: se.exercise_id ?? 0,
      duration_seconds: se.duration_seconds || 30,
      rest_after_seconds: 5,
      order_index: i,
      superset_group: null,
      exercise:
        se.exercise_id != null
          ? {
              id: se.exercise_id,
              name: se.exercise_name,
              description: "",
              category: "strength",
              default_kcal_per_min: 5,
              default_duration_seconds: se.duration_seconds || 30,
              image_url: se.image_url,
              created_at: "",
            }
          : null,
    })),
    work_duration_seconds: session.total_duration_seconds,
    rest_duration_seconds: 0,
    total_duration_seconds: session.total_duration_seconds,
  };
}

/** Modal showing a session's stats, per-exercise breakdown, date editing, and inline notes. */
export default function SessionDetail({
  session,
  onClose,
  onUpdate,
  onStartWorkout,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onUpdate: (updated: WorkoutSession) => void;
  onStartWorkout: (template: WorkoutTemplate) => void;
}) {
  const [notes, setNotes] = useState(session.notes || "");
  const [durationMinutes, setDurationMinutes] = useState(
    String(Math.round(session.total_duration_seconds / 60))
  );
  const [dateValue, setDateValue] = useState(() => toLocalDatetimeLocal(session.started_at));
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, handleClose);

  const isBoxing = session.template_name.startsWith("Boxing:");
  const isRunOrWalk = session.template_name.startsWith("Run:") || session.template_name.startsWith("Walk:");
  const isRegular = !isBoxing && !isRunOrWalk;
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
      logger.error("Failed to update boxing session", err);
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
      logger.error("Failed to update session date", err);
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
      logger.error("Failed to save notes", err);
    }
  }

  async function saveDuration() {
    const mins = parseInt(durationMinutes) || 0;
    if (mins <= 0 || mins * 60 === session.total_duration_seconds) return;
    try {
      const updated = await api.updateSession(session.id, {
        total_duration_seconds: mins * 60,
      });
      onUpdate(updated);
      setDurationMinutes(String(Math.round(updated.total_duration_seconds / 60)));
    } catch (err) {
      logger.error("Failed to save duration", err);
    }
  }

  const isRun = session.template_name.startsWith("Run:");

  const [runEntry, setRunEntry] = useState<RunEntryResponse | null>(null);
  const [runDistanceEdit, setRunDistanceEdit] = useState("");
  const [runMinutesEdit, setRunMinutesEdit] = useState("");

  useEffect(() => {
    if (!isRunOrWalk || session.run_entry_id == null) return;
    let active = true;
    api
      .getRuns()
      .then((list) => {
        if (!active) return;
        const e = list.find((r) => r.id === session.run_entry_id);
        if (e) {
          setRunEntry(e);
          setRunDistanceEdit(e.distance_km.toString());
          setRunMinutesEdit(String(Math.round(e.duration_seconds / 60)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isRunOrWalk, session.run_entry_id]);

  async function saveRun() {
    if (!runEntry) return;
    const dist = parseFloat(runDistanceEdit);
    const mins = parseInt(runMinutesEdit) || 0;
    if (isNaN(dist) || dist <= 0 || mins <= 0) return;
    try {
      await api.updateRun(runEntry.id, {
        duration_seconds: mins * 60,
        distance_km: dist,
        run_type: isRun ? "run" : "walk",
        date: runEntry.date.slice(0, 10),
        notes: runEntry.notes,
      });
      const [updated, list] = await Promise.all([
        api.getSession(session.id),
        api.getRuns(),
      ]);
      onUpdate(updated);
      const e = list.find((r) => r.id === runEntry.id);
      if (e) setRunEntry(e);
    } catch (err) {
      logger.error("Failed to update run", err);
    }
  }

  const runDirty =
    !!runEntry &&
    ((parseInt(runMinutesEdit) || 0) * 60 !== runEntry.duration_seconds ||
      parseFloat(runDistanceEdit) !== runEntry.distance_km);

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
      logger.error("Failed to toggle run type", err);
    }
  }

  const notesDirty = notes.trim() !== (session.notes || "");
  const durationDirty =
    isRegular && ((parseInt(durationMinutes) || 0) * 60 !== session.total_duration_seconds);
  const dateDirty = dateValue !== toLocalDatetimeLocal(session.started_at);

  const hasUnsavedChanges = notesDirty || durationDirty || dateDirty || boxDirty || runDirty;

  /** Close, but only after confirming when there are unsaved edits. */
  function handleClose() {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={session.template_name}
        className="bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] border border-fg/10 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{session.template_name}</h2>
          <button
            onClick={handleClose}
            className="text-fg/40 hover:text-fg/70 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {isRegular && session.exercises.length > 0 && (
          <button
            onClick={() => {
              onStartWorkout(sessionToTemplate(session));
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 text-sm text-accent/70 hover:text-accent border border-accent/30 hover:border-accent/50 rounded-xl py-2.5 mb-4 transition-colors"
          >
            <PlayCircle size={16} weight="fill" /> Repeat Workout
          </button>
        )}

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
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            onBlur={() => updateStartedAt(dateValue)}
            className="w-full bg-surface border border-fg/10 rounded-lg px-3 py-1.5 text-xs text-fg outline-none focus:border-accent/50"
          />
        </p>

        {isRegular && (
          <div className="bg-surface rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-fg/40 font-medium">Duration (minutes)</p>
              {durationDirty && (
                <button
                  onClick={saveDuration}
                  className="text-[10px] text-accent font-medium hover:underline"
                >
                  Save
                </button>
              )}
            </div>
            <input
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => { if (e.key === "Enter") saveDuration(); }}
              aria-label="Session duration minutes"
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
            />
          </div>
        )}

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
                      <ExerciseImage
                        src={ex.image_url}
                        alt={ex.exercise_name}
                        className="w-8 h-8 rounded-md shrink-0"
                        category="strength"
                      />
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

        {isRunOrWalk && runEntry && (
          <div className="bg-surface rounded-lg p-3 mb-4 space-y-3">
            <p className="text-[10px] text-fg/40 font-medium">Edit {isRun ? "run" : "walk"}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-fg/40 mb-1">Distance (km)</p>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={runDistanceEdit}
                  onChange={(e) => setRunDistanceEdit(e.target.value)}
                  aria-label="Run distance km"
                  className="w-full bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <p className="text-[10px] text-fg/40 mb-1">Minutes</p>
                <input
                  type="number"
                  min="1"
                  value={runMinutesEdit}
                  onChange={(e) => setRunMinutesEdit(e.target.value)}
                  aria-label="Run minutes"
                  className="w-full bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </div>
            </div>
            {runDirty && (
              <button
                onClick={saveRun}
                disabled={!(parseFloat(runDistanceEdit) > 0) || (parseInt(runMinutesEdit) || 0) <= 0}
                className="w-full bg-accent text-on-accent rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Save changes
              </button>
            )}
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