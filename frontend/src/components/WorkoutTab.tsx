import { useEffect, useState } from "react";
import {
  CheckCircle,
  SmileySad,
} from "@phosphor-icons/react";
import {
  api,
  type Exercise,
  type WorkoutTemplate,
} from "../api";
import { formatDuration } from "../format";
import WorkoutEditor from "./WorkoutEditor";

interface WorkoutTabProps {
  onStartWorkout: (workout: WorkoutTemplate) => void;
}

export default function WorkoutTab({ onStartWorkout }: WorkoutTabProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

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

  return (
    <div className="workout-tab">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm text-fg/50 font-medium">My Workouts</h2>
        <button
          onClick={() => openEditor(null)}
          className="bg-accent text-on-accent rounded-xl px-4 py-2 text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          + New Workout
        </button>
      </div>

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
    </div>
  );
}
