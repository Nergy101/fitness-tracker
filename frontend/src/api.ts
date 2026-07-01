// Typed client for the FitnessTracker FastAPI backend.
// Mirrors backend/app/schemas.py.

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type Category = "cardio" | "strength" | "flexibility" | "other";

export interface Exercise {
  id: number;
  name: string;
  description: string;
  category: Category;
  default_kcal_per_min: number;
  default_duration_seconds: number;
  image_url: string | null;
  created_at: string;
}

export interface ExerciseInput {
  name: string;
  description: string;
  category: Category;
  default_kcal_per_min: number;
  default_duration_seconds: number;
  image_url?: string | null;
}

export interface TemplateExercise {
  id: number;
  template_id: number;
  exercise_id: number;
  duration_seconds: number;
  order_index: number;
  exercise: Exercise | null;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  description: string;
  rounds: number;
  rest_between_rounds: number;
  created_at: string;
  exercises: TemplateExercise[];
  work_duration_seconds: number;
  rest_duration_seconds: number;
  total_duration_seconds: number;
}

export interface TemplateExerciseInput {
  exercise_id: number;
  duration_seconds: number;
  order_index: number;
}

export interface WorkoutTemplateInput {
  name: string;
  description: string;
  rounds: number;
  rest_between_rounds: number;
  exercises: TemplateExerciseInput[];
}

export interface SessionExercise {
  id: number;
  session_id: number;
  exercise_id: number | null;
  exercise_name: string;
  duration_seconds: number;
  kcal_burned: number;
  order_index: number;
  completed: boolean;
}

export interface WorkoutSession {
  id: number;
  template_id: number | null;
  template_name: string;
  started_at: string;
  finished_at: string | null;
  total_duration_seconds: number;
  total_kcal_estimated: number;
  exercises: SessionExercise[];
}

export interface SessionExerciseInput {
  exercise_id: number | null;
  exercise_name: string;
  duration_seconds: number;
  kcal_burned: number;
  order_index: number;
  completed: boolean;
}

export interface WorkoutSessionInput {
  template_id: number | null;
  template_name: string;
  total_duration_seconds: number;
  total_kcal_estimated: number;
  exercises: SessionExerciseInput[];
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // Exercises
  getExercises: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    return fetchJSON<Exercise[]>(`/api/v1/exercises${params}`);
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

  // Workouts
  getWorkouts: () => fetchJSON<WorkoutTemplate[]>("/api/v1/workouts"),
  getWorkout: (id: number) =>
    fetchJSON<WorkoutTemplate>(`/api/v1/workouts/${id}`),
  createWorkout: (data: WorkoutTemplateInput) =>
    fetchJSON<WorkoutTemplate>("/api/v1/workouts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWorkout: (id: number, data: Partial<WorkoutTemplateInput>) =>
    fetchJSON<WorkoutTemplate>(`/api/v1/workouts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteWorkout: (id: number) =>
    fetchJSON<void>(`/api/v1/workouts/${id}`, { method: "DELETE" }),

  // Sessions
  getSessions: () => fetchJSON<WorkoutSession[]>("/api/v1/sessions"),
  getSession: (id: number) =>
    fetchJSON<WorkoutSession>(`/api/v1/sessions/${id}`),
  createSession: (data: WorkoutSessionInput) =>
    fetchJSON<WorkoutSession>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSession: (id: number) =>
    fetchJSON<void>(`/api/v1/sessions/${id}`, { method: "DELETE" }),
};
