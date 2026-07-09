import { useEffect, useState } from "react";
import { CheckCircleIcon as CheckCircle, SmileySadIcon as SmileySad } from "@phosphor-icons/react";
import Toast from "./Toast";
import {
  api,
  type Exercise,
  type WorkoutTemplate,
} from "../api";
import WorkoutEditor from "./WorkoutEditor";
import RunLogger from "./RunLogger";
import BoxingLogger from "./BoxingLogger";
import WorkoutCard from "./WorkoutCard";

interface WorkoutTabProps {
  onStartWorkout: (workout: WorkoutTemplate) => void;
  onLogWorkout?: () => void;
}

const DEFAULT_KCAL_PER_MIN = 5;

function kcalFor(durationSeconds: number, kcalPerMin: number): number {
  return (durationSeconds / 60) * kcalPerMin;
}

export default function WorkoutTab({ onStartWorkout, onLogWorkout }: WorkoutTabProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getWorkouts(), api.getExercises()])
      .then(([tpls, exs]) => {
        setTemplates(tpls);
        setAllExercises(exs);
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

  async function togglePin(tpl: WorkoutTemplate) {
    try {
      const updated = await api.togglePin(tpl.id, !tpl.is_pinned);
      setTemplates((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      setToast(updated.is_pinned ? "Workout pinned" : "Workout unpinned");
    } catch {
      setToast("Failed to update pin");
    }
  }

  // Sort: pinned first (by pinned_order), then most recent first
  const sortedTemplates = [...templates].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    if (a.is_pinned && b.is_pinned) {
      const ao = a.pinned_order ?? 0;
      const bo = b.pinned_order ?? 0;
      if (ao !== bo) return ao - bo;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function logWorkout(tpl: WorkoutTemplate) {
    const rounds = Math.max(1, tpl.rounds || 1);
    const workDuration =
      tpl.exercises.reduce((sum, e) => sum + (e.duration_seconds || 30), 0) *
      rounds;
    const restDuration =
      Math.max(0, rounds - 1) * (tpl.rest_between_rounds || 0);
    const warmupDuration = tpl.warmup_seconds || 0;
    const cooldownDuration = tpl.cooldown_seconds || 0;
    const totalKcal =
      tpl.exercises.reduce(
        (sum, e) =>
          sum +
          kcalFor(
            e.duration_seconds || 30,
            e.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN,
          ),
        0,
      ) * rounds;

    try {
      await api.createSession({
        template_id: tpl.id,
        template_name: tpl.name || "",
        total_duration_seconds: workDuration + restDuration + warmupDuration + cooldownDuration,
        total_kcal_estimated: totalKcal,
        exercises: tpl.exercises.map((e, i) => ({
          exercise_id: e.exercise?.id ?? e.exercise_id,
          exercise_name: e.exercise?.name || "",
          duration_seconds: e.duration_seconds || 30,
          kcal_burned: kcalFor(
            e.duration_seconds || 30,
            e.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN,
          ),
          order_index: i,
          completed: true,
        })),
      });
      setToast("Workout logged!");
      onLogWorkout?.();
    } catch {
      setToast("Failed to log workout");
    }
  }

  async function deleteWorkout(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteWorkout(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setToast(`"${name}" deleted`);
    } catch {
      setToast("Failed to delete workout");
    }
  }

  async function cloneWorkout(tpl: WorkoutTemplate) {
    try {
      const clone = await api.duplicateWorkout(tpl.id);
      setTemplates((prev) => [...prev, clone]);
      setToast(`Duplicated as "${clone.name}"`);
      openEditor(clone);
    } catch {
      setToast("Failed to duplicate workout");
    }
  }

  return (
    <div className="workout-tab">
      {/* Toast */}
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <CheckCircle size={18} weight="fill" />
          {toast}
        </Toast>
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

      {/* Log a Run */}
      <RunLogger onRunLogged={() => onLogWorkout?.()} />

      {/* Log Boxing */}
      <BoxingLogger onWorkoutLogged={() => onLogWorkout?.()} />

      {/* Workout Templates */}
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
          {sortedTemplates.map((tpl) => (
            <WorkoutCard
              key={tpl.id}
              template={tpl}
              onStart={onStartWorkout}
              onEdit={openEditor}
              onClone={cloneWorkout}
              onDelete={deleteWorkout}
              onLog={logWorkout}
              onTogglePin={togglePin}
            />
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