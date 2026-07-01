import { useMemo, useRef, useState } from "react";
import {
  api,
  type Exercise,
  type WorkoutTemplate,
} from "../api";
import ExerciseImage from "./ExerciseImage";
import Stepper from "./Stepper";
import { formatDuration } from "../format";

interface EditorRow {
  key: number;
  exercise_id: number;
  exercise_name: string;
  duration_seconds: number;
}

function rowsFromTemplate(
  workout: WorkoutTemplate | null,
  nextKey: () => number,
): EditorRow[] {
  if (!workout) return [];
  return workout.exercises.map((e) => ({
    key: nextKey(),
    exercise_id: e.exercise?.id ?? e.exercise_id,
    exercise_name: e.exercise?.name ?? "",
    duration_seconds: e.duration_seconds || 30,
  }));
}

interface WorkoutEditorProps {
  workout: WorkoutTemplate | null;
  exercises: Exercise[];
  onSave: () => void;
  onClose: () => void;
}

export default function WorkoutEditor({
  workout,
  exercises,
  onSave,
  onClose,
}: WorkoutEditorProps) {
  const isEditing = Boolean(workout?.id);
  const keyRef = useRef(0);
  const nextKey = () => keyRef.current++;

  const [name, setName] = useState(workout?.name ?? "");
  const [rounds, setRounds] = useState(workout?.rounds ?? 1);
  const [restBetween, setRestBetween] = useState(
    workout?.rest_between_rounds ?? 180,
  );
  const [rows, setRows] = useState<EditorRow[]>(() =>
    rowsFromTemplate(workout, nextKey),
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredExercises = useMemo(() => {
    const existing = new Set(rows.map((r) => r.exercise_id));
    const q = pickerSearch.toLowerCase();
    return exercises.filter(
      (e) =>
        !existing.has(e.id) && (!q || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, rows, pickerSearch]);

  const totalDuration = rows.reduce(
    (sum, r) => sum + (r.duration_seconds || 30),
    0,
  );

  function addExercise(ex: Exercise) {
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        exercise_id: ex.id,
        exercise_name: ex.name,
        duration_seconds: ex.default_duration_seconds || 30,
      },
    ]);
    setShowPicker(false);
    setPickerSearch("");
  }

  function move(i: number, delta: number) {
    setRows((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function setDuration(key: number, value: number) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, duration_seconds: value } : r)),
    );
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name,
        description: workout?.description ?? "",
        rounds: Math.max(1, rounds || 1),
        rest_between_rounds: Math.max(0, restBetween || 0),
        exercises: rows.map((r, i) => ({
          exercise_id: r.exercise_id,
          duration_seconds: r.duration_seconds || 30,
          order_index: i,
        })),
      };
      if (isEditing && workout) {
        await api.updateWorkout(workout.id, payload);
      } else {
        await api.createWorkout(payload);
      }
      onSave();
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 border border-fg/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {isEditing ? workout?.name : "New Workout"}
          </h2>
          <button
            onClick={onClose}
            className="text-fg/40 hover:text-fg/70 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          placeholder="Workout name..."
          className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 mb-4"
        />

        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="rounds" className="text-sm text-fg/60">
            Rounds
          </label>
          <Stepper
            value={rounds}
            onChange={setRounds}
            min={1}
            max={20}
            ariaLabel="Rounds"
          />
          <span className="text-xs text-fg/40">
            repeat the whole circuit this many times
          </span>
        </div>

        {rounds > 1 && (
          <div className="mb-4">
            <label className="text-sm text-fg/60 block mb-2">
              Rest between rounds
            </label>
            <div className="flex gap-2">
              {[
                { label: "1 min", value: 60 },
                { label: "3 min", value: 180 },
                { label: "5 min", value: 300 },
                { label: "10 min", value: 600 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRestBetween(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    restBetween === opt.value
                      ? "bg-accent text-on-accent"
                      : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-2 text-sm text-accent mb-3 hover:text-accent-hover transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add Exercise
        </button>

        {showPicker && (
          <div className="bg-surface rounded-xl border border-fg/10 p-2 mb-3 max-h-40 overflow-y-auto">
            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              type="text"
              placeholder="Search..."
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none mb-2"
            />
            {filteredExercises.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-fg/5 rounded-lg cursor-pointer text-sm"
                onClick={() => addExercise(ex)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <ExerciseImage
                    src={ex.image_url}
                    alt={ex.name}
                    iconSize={14}
                    className="w-8 h-8 rounded-md shrink-0"
                  />
                  <span className="truncate">{ex.name}</span>
                </span>
                <span className="text-xs text-fg/40">
                  {ex.default_duration_seconds}s
                </span>
              </div>
            ))}
            {filteredExercises.length === 0 && (
              <div className="text-xs text-fg/30 text-center py-2">
                No exercises match
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 min-h-0">
          {rows.length === 0 && (
            <div className="text-center py-8 text-fg/20 text-sm">
              Add exercises to build your workout
            </div>
          )}
          {rows.map((item, i) => (
            <div
              key={item.key}
              className="bg-surface rounded-xl px-3 py-2 flex items-center gap-2 border border-fg/5"
            >
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-fg/20 hover:text-fg/60 disabled:opacity-20 p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m18 15-6-6-6 6" />
                </svg>
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="text-fg/20 hover:text-fg/60 disabled:opacity-20 p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {item.exercise_name}
                </div>
                <div className="flex items-center gap-2">
                  <Stepper
                    value={item.duration_seconds}
                    onChange={(v) => setDuration(item.key, v)}
                    min={5}
                    max={600}
                    step={5}
                    unit="s"
                    ariaLabel={`${item.exercise_name} duration`}
                  />
                </div>
              </div>

              <button
                onClick={() => removeRow(item.key)}
                className="text-red-400/50 hover:text-red-400 p-0.5"
                title="Remove"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-fg/10 pt-3 flex items-center justify-between">
          <div className="text-sm text-fg/50 flex flex-wrap gap-x-2">
            <span>{rows.length} exercises</span>
            {rounds > 1 && <span className="text-fg/40">&times; {rounds} rounds</span>}
            <span className="text-fg/40">&middot;</span>
            <span>work {formatDuration(totalDuration * Math.max(1, rounds || 1))}</span>
            {rounds > 1 && restBetween > 0 && (
              <span>+ rest {rounds - 1}&times;{formatDuration(restBetween)}</span>
            )}
            <span className="text-accent">
              = {formatDuration(totalDuration * Math.max(1, rounds || 1) + Math.max(0, rounds - 1) * restBetween)}
            </span>
          </div>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-accent text-on-accent rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
