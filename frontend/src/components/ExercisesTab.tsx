import { useEffect, useMemo, useState } from "react";
import { SmileySadIcon as SmileySad } from "@phosphor-icons/react";
import {
  api,
  type Category,
  type Exercise,
  type ExerciseInput,
} from "../api";
import ExerciseImage from "./ExerciseImage";
import ExercisesSkeleton from "./skeletons/ExercisesSkeleton";
import Stepper from "./Stepper";

const CATEGORY_BADGE: Record<Category, string> = {
  cardio: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  strength: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  flexibility: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  other: "bg-gray-200 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
};

const EMPTY_FORM: ExerciseInput = {
  name: "",
  description: "",
  category: "other",
  default_duration_seconds: 30,
  default_kcal_per_min: 5.0,
};

export default function ExercisesTab() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ExerciseInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadExercises() {
    try {
      setExercises(await api.getExercises());
      setError(null);
    } catch {
      setError("Failed to load exercises");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExercises();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exercises.filter(
      (e) =>
        (categoryFilter === "all" || e.category === categoryFilter) &&
        (!q || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, search, categoryFilter]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(ex: Exercise) {
    setEditingId(ex.id);
    setForm({
      name: ex.name,
      description: ex.description || "",
      category: ex.category,
      default_duration_seconds: ex.default_duration_seconds,
      default_kcal_per_min: ex.default_kcal_per_min,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function saveExercise() {
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateExercise(editingId, form);
      } else {
        await api.createExercise(form);
      }
      setShowForm(false);
      setEditingId(null);
      await loadExercises();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="exercises-tab">
      <div className="flex items-center justify-between mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Search exercises..."
          className="flex-1 bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50"
        />
        <button
          onClick={openCreate}
          className="ml-3 bg-accent text-on-accent rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-accent-hover transition-colors whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(["all", "cardio", "strength", "flexibility", "other"] as const).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? "bg-accent text-on-accent"
                  : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <ExercisesSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center py-8 text-red-400">
          <SmileySad size={40} weight="regular" className="mb-3 opacity-80" />
          <p>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-fg/30">
          <p className="text-lg mb-1">No exercises found</p>
          <p className="text-sm text-fg/20">
            Try a different search or add one!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="bg-surface rounded-xl p-3 border border-fg/5 cursor-pointer hover:border-accent/30 transition-colors"
              onClick={() => openEdit(ex)}
            >
              <div className="flex items-center gap-3">
                <ExerciseImage
                  src={ex.image_url}
                  alt={ex.name}
                  className="w-14 h-14 rounded-lg shrink-0 border border-fg/5"
                  category={ex.category}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-sm truncate">{ex.name}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_BADGE[ex.category]}`}
                    >
                      {ex.category}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-fg/40">
                    <span>{ex.default_duration_seconds}s</span>
                    <span>{ex.default_kcal_per_min} kcal/min</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] border border-fg/10 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit Exercise" : "New Exercise"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-fg/60 block mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  type="text"
                  placeholder="e.g. Burpees"
                  className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50"
                />
                {formError && (
                  <p className="text-red-400 text-xs mt-1">{formError}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-fg/60 block mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-fg/60 block mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as Category })
                  }
                  className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50"
                >
                  <option value="cardio">Cardio</option>
                  <option value="strength">Strength</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-fg/60 block mb-1">
                  Default Duration (seconds)
                </label>
                <Stepper
                  value={form.default_duration_seconds}
                  onChange={(v) =>
                    setForm({ ...form, default_duration_seconds: v })
                  }
                  min={5}
                  max={300}
                  step={5}
                  unit="s"
                  ariaLabel="Default duration"
                />
              </div>

              <div>
                <label className="text-sm text-fg/60 block mb-1">
                  Kcal per Minute
                </label>
                <input
                  value={form.default_kcal_per_min}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_kcal_per_min: Number(e.target.value),
                    })
                  }
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-fg/10 rounded-xl py-2.5 text-sm font-medium hover:bg-fg/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveExercise}
                  disabled={saving}
                  className="flex-1 bg-accent text-on-accent rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
