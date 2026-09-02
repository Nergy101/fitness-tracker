// Exercise catalog + per-set log types and methods.

import { API_BASE, fetchJSON } from "./client";
import { getStoredAuth } from "../auth";

export type Category = "cardio" | "strength" | "flexibility" | "other";

export interface Exercise {
  id: number;
  name: string;
  description: string;
  category: Category;
  default_kcal_per_min: number;
  default_duration_seconds: number;
  image_url: string | null;
  equipment?: string;
  muscle_group?: string;
  created_at: string;
}

export interface ExerciseInput {
  name: string;
  description: string;
  category: Category;
  default_kcal_per_min: number;
  default_duration_seconds: number;
  image_url?: string | null;
  equipment?: string;
  muscle_group?: string;
}

export interface ExerciseLog {
  id: number;
  session_exercise_id: number;
  weight_kg: number | null;
  reps: number | null;
  set_number: number;
  rpe?: number | null;
  notes?: string;
  created_at: string;
}

export interface ExerciseLogInput {
  weight_kg: number | null;
  reps: number | null;
  set_number: number;
  rpe?: number | null;
  notes?: string;
}

// ─── Exercise list cache ───────────────────────────────────────────────
// The exercise catalog is near-static seeded data, so we serve it from
// localStorage to make startup instant and work offline, then refresh in the
// background once the cache is stale (TTL). Search queries always hit the API.
const EXERCISES_CACHE_KEY = "fitness_exercises_cache_v1";
const EXERCISES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface ExerciseCache {
  version: number;
  cachedAt: number;
  exercises: Exercise[];
}

function readExerciseCache(): ExerciseCache | null {
  try {
    const raw = localStorage.getItem(EXERCISES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExerciseCache;
    if (!parsed || !Array.isArray(parsed.exercises)) return null;
    return parsed;
  } catch {
    return null; // missing or corrupted — fall back to the API
  }
}

function writeExerciseCache(exercises: Exercise[]): void {
  try {
    localStorage.setItem(
      EXERCISES_CACHE_KEY,
      JSON.stringify({ version: 1, cachedAt: Date.now(), exercises }),
    );
  } catch {
    // storage full / unavailable — ignore
  }
}

function fetchExercisesFresh(): Promise<Exercise[]> {
  return fetchJSON<Exercise[]>("/api/v1/exercises").then((exercises) => {
    writeExerciseCache(exercises);
    return exercises;
  });
}

export const exercisesApi = {
  getExercises: (search?: string) => {
    if (search) {
      const params = `?search=${encodeURIComponent(search)}`;
      return fetchJSON<Exercise[]>(`/api/v1/exercises${params}`);
    }
    const cached = readExerciseCache();
    if (cached) {
      const stale = Date.now() - cached.cachedAt >= EXERCISES_CACHE_TTL_MS;
      if (stale) {
        // Serve cached immediately; refresh in the background so the next
        // load sees any newly-seeded exercises.
        fetchExercisesFresh().catch(() => {});
      }
      return Promise.resolve(cached.exercises);
    }
    // No cache yet (first load, or it was cleared) — fetch and populate it.
    return fetchExercisesFresh().catch(() => [] as Exercise[]);
  },
  getExercise: (id: number) => fetchJSON<Exercise>(`/api/v1/exercises/${id}`),
  createExercise: (data: ExerciseInput) =>
    fetchJSON<Exercise>("/api/v1/exercises", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateExercise: (id: number, data: Partial<ExerciseInput>) =>
    fetchJSON<Exercise>(`/api/v1/exercises/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteExercise: (id: number) =>
    fetchJSON<void>(`/api/v1/exercises/${id}`, { method: "DELETE" }),
  getExerciseLogs: (exerciseId: number, limit = 10) =>
    fetchJSON<ExerciseLog[]>(
      `/api/v1/exercises/${exerciseId}/logs?limit=${limit}`,
    ),
  downloadExport: async (entity: string): Promise<void> => {
    const token = getStoredAuth();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/v1/export/${entity}`, { headers });
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)/.exec(disposition);
    const filename = match ? match[1] : `${entity}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
