// Typed client for the FitnessTracker FastAPI backend.
// Mirrors backend/app/schemas.py.

// Empty string → same-origin relative requests (Docker: nginx proxies /api to
// the backend). Unset → localhost:8000 for `npm run dev` convenience.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
  started_at?: string | null;
  finished_at?: string | null;
}

// ─── Health Types ────────────────────────────────────────

export interface UserProfileResponse {
  height_cm: number | null;
  birthday: string | null;
  gender: string | null;
  goal_weight_kg: number | null;
  weight_unit: string;
  reminder_time: string | null;
  notifications_enabled: boolean;
}

export interface UserProfileUpdate {
  height_cm?: number | null;
  birthday?: string | null;
  gender?: string | null;
  goal_weight_kg?: number | null;
  weight_unit?: string;
  reminder_time?: string | null;
  notifications_enabled?: boolean;
}

export interface WeightEntryResponse {
  id: number;
  weight_kg: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface WeightEntryCreate {
  weight_kg: number;
  date?: string;
  notes?: string;
}

export interface WeightStatsResponse {
  latest: WeightEntryResponse | null;
  min: WeightEntryResponse | null;
  max: WeightEntryResponse | null;
  avg_7d: number | null;
  avg_30d: number | null;
  total_entries: number;
}

export interface StreakResponse {
  current_streak: number;
  best_streak: number;
  last_logged_date: string | null;
}

export interface GoalProgressResponse {
  start_weight_kg: number | null;
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  progress_percentage: number | null;
  remaining_kg: number | null;
}

export interface BodyMeasurementResponse {
  id: number;
  date: string;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  neck_cm: number | null;
  estimated_body_fat_pct: number | null;
  body_fat_method: string | null;
  notes: string;
  created_at: string;
}

export interface BodyMeasurementCreate {
  date?: string;
  waist_cm?: number | null;
  hips_cm?: number | null;
  chest_cm?: number | null;
  left_arm_cm?: number | null;
  right_arm_cm?: number | null;
  left_thigh_cm?: number | null;
  right_thigh_cm?: number | null;
  neck_cm?: number | null;
  estimated_body_fat_pct?: number | null;
  body_fat_method?: string | null;
  notes?: string;
}

export interface MeasurementChangesResponse {
  first: BodyMeasurementResponse | null;
  latest: BodyMeasurementResponse | null;
  deltas: Record<string, number | null>;
}

export interface WellnessResponse {
  id: number;
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  notes: string;
  created_at: string;
}

export interface WellnessCreate {
  date?: string;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  sleep_hours?: number | null;
  notes?: string;
}

export interface WellnessTrendsResponse {
  weekly_averages: WellnessWeek[];
}

export interface WellnessWeek {
  week_start: string;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_stress: number | null;
  avg_sleep: number | null;
  entry_count: number;
}

export interface BmiResponse {
  bmi: number | null;
  category: string | null;
  color: string | null;
  message: string;
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
}

export interface HealthScoreResponse {
  score: number;
  bmi_score: number;
  workout_score: number;
  streak_score: number;
  measurement_score: number;
  spotlight: string;
}

// ─── Run Types ───────────────────────────────────────────

export interface RunEntryResponse {
  id: number;
  duration_seconds: number;
  distance_km: number;
  pace_per_km: number | null;
  date: string;
  notes: string;
  created_at: string;
}

export interface RunEntryCreate {
  duration_seconds: number;
  distance_km: number;
  date?: string;
  notes?: string;
}

export interface MonthlyBreakdown {
  month: string;
  distance_km: number;
  duration_seconds: number;
  runs: number;
  pace: number | null;
}

export interface RunStatsResponse {
  total_runs: number;
  total_distance_km: number;
  total_duration_seconds: number;
  avg_pace_per_km: number | null;
  current_week_distance_km: number;
  previous_week_distance_km: number;
  best_week_distance_km: number;
  fastest_5k_seconds: number | null;
  fastest_10k_seconds: number | null;
  longest_run_seconds: number | null;
  longest_run_distance_km: number | null;
  monthly_breakdown: MonthlyBreakdown[];
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

  // ─── Health ──────────────────────────────────────────

  // Profile
  getProfile: () => fetchJSON<UserProfileResponse>("/api/v1/health/profile"),
  updateProfile: (data: UserProfileUpdate) =>
    fetchJSON<UserProfileResponse>("/api/v1/health/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Weight
  getWeightEntries: () =>
    fetchJSON<WeightEntryResponse[]>("/api/v1/health/weight"),
  createWeightEntry: (data: WeightEntryCreate) =>
    fetchJSON<WeightEntryResponse>("/api/v1/health/weight", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWeightEntry: (id: number, data: WeightEntryCreate) =>
    fetchJSON<WeightEntryResponse>(`/api/v1/health/weight/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteWeightEntry: (id: number) =>
    fetchJSON<void>(`/api/v1/health/weight/${id}`, { method: "DELETE" }),
  getWeightStats: () =>
    fetchJSON<WeightStatsResponse>("/api/v1/health/weight/stats"),
  getWeightStreak: () =>
    fetchJSON<StreakResponse>("/api/v1/health/weight/streak"),

  // Goal
  getGoalProgress: () =>
    fetchJSON<GoalProgressResponse>("/api/v1/health/goal-progress"),

  // Measurements
  getMeasurements: () =>
    fetchJSON<BodyMeasurementResponse[]>("/api/v1/health/measurements"),
  createMeasurement: (data: BodyMeasurementCreate) =>
    fetchJSON<BodyMeasurementResponse>("/api/v1/health/measurements", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMeasurement: (id: number, data: BodyMeasurementCreate) =>
    fetchJSON<BodyMeasurementResponse>(
      `/api/v1/health/measurements/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  deleteMeasurement: (id: number) =>
    fetchJSON<void>(`/api/v1/health/measurements/${id}`, {
      method: "DELETE",
    }),
  getMeasurementChanges: () =>
    fetchJSON<MeasurementChangesResponse>(
      "/api/v1/health/measurements/changes",
    ),

  // Wellness
  getWellnessEntries: () =>
    fetchJSON<WellnessResponse[]>("/api/v1/health/wellness"),
  createWellnessEntry: (data: WellnessCreate) =>
    fetchJSON<WellnessResponse>("/api/v1/health/wellness", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWellnessTrends: () =>
    fetchJSON<WellnessTrendsResponse>("/api/v1/health/wellness/trends"),

  // BMI & Score
  getBmi: () => fetchJSON<BmiResponse>("/api/v1/health/bmi"),
  getHealthScore: () =>
    fetchJSON<HealthScoreResponse>("/api/v1/health/score"),

  // ─── Runs ───────────────────────────────────────────

  getRuns: () => fetchJSON<RunEntryResponse[]>("/api/v1/runs"),
  createRun: (data: RunEntryCreate) =>
    fetchJSON<RunEntryResponse>("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRun: (id: number, data: RunEntryCreate) =>
    fetchJSON<RunEntryResponse>(`/api/v1/runs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRun: (id: number) =>
    fetchJSON<void>(`/api/v1/runs/${id}`, { method: "DELETE" }),
  getRunStats: () =>
    fetchJSON<RunStatsResponse>("/api/v1/runs/stats"),
};
