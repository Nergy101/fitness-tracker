// Typed client for the FitnessTracker FastAPI backend.
// Mirrors backend/app/schemas.py.

import { getStoredAuth, clearStoredAuth } from "./auth";

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
  rest_after_seconds: number;
  order_index: number;
  superset_group: number | null;
  exercise: Exercise | null;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  description: string;
  mode: string;
  time_cap_seconds: number | null;
  rounds: number;
  rest_between_rounds: number;
  is_pinned: boolean;
  pinned_order: number | null;
  warmup_seconds: number;
  cooldown_seconds: number;
  created_at: string;
  exercises: TemplateExercise[];
  work_duration_seconds: number;
  rest_duration_seconds: number;
  total_duration_seconds: number;
}

export interface TemplateExerciseInput {
  exercise_id: number;
  duration_seconds: number;
  rest_after_seconds: number;
  order_index: number;
  superset_group?: number | null;
}

export interface WorkoutTemplateInput {
  name: string;
  description: string;
  mode?: string;
  time_cap_seconds?: number | null;
  rounds?: number;
  rest_between_rounds?: number;
  warmup_seconds?: number;
  cooldown_seconds?: number;
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
  logs: ExerciseLog[];
}

export interface ExerciseLog {
  id: number;
  session_exercise_id: number;
  weight_kg: number | null;
  reps: number | null;
  set_number: number;
  created_at: string;
}

export interface ExerciseLogInput {
  weight_kg: number | null;
  reps: number | null;
  set_number: number;
}

export interface WorkoutSession {
  id: number;
  template_id: number | null;
  template_name: string;
  started_at: string;
  finished_at: string | null;
  total_duration_seconds: number;
  total_kcal_estimated: number;
  notes: string;
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
  notes?: string;
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

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: { p256dh: string; auth: string };
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

export interface PrsResponse {
  // Runs
  longest_run_km: number | null;
  longest_run_seconds: number | null;
  fastest_5k_seconds: number | null;
  fastest_10k_seconds: number | null;
  best_pace_seconds_per_km: number | null;
  most_kcal_run: number | null;
  best_week_run_km: number | null;
  // Walks
  longest_walk_km: number | null;
  longest_walk_seconds: number | null;
  most_kcal_walk: number | null;
  // Workouts
  longest_workout_seconds: number | null;
  most_kcal_workout: number | null;
  most_exercises_workout: number | null;
  // Overall
  longest_streak_days: number;
}

export interface WeeklyActivityStat {
  week_start: string;
  workout_minutes: number;
  run_minutes: number;
  walk_minutes: number;
  run_km: number;
  walk_km: number;
  workout_kcal: number;
  run_kcal: number;
  walk_kcal: number;
}

export interface StatsOverviewResponse {
  activity_weekly: WeeklyActivityStat[];
  total_kcal_burned: number;
  consistency_score_pct: number;
  total_sessions_all: number;
  total_runs: number;
  total_walks: number;
  current_month_minutes: number;
  previous_month_minutes: number;
  current_month_vs_previous_pct: number | null;
  avg_weight_change_kg: number | null;
}

export interface SleepStages {
  deep: number | null;
  core: number | null;
  rem: number | null;
  awake: number | null;
}

export interface HealthPoint {
  date: string;
  value: number;
  min: number | null;
  max: number | null;
  /** Only populated on sleep_analysis points with a stage breakdown. */
  stages: SleepStages | null;
}

export interface HealthSeries {
  metric: string;
  label: string;
  unit: string;
  points: HealthPoint[];
}

export interface HealthInsightsResponse {
  series: HealthSeries[];
}

export interface HealthWorkoutSummary {
  date: string;
  name: string;
  duration_min: number | null;
  distance_km: number | null;
  energy_kcal: number | null;
  avg_hr: number | null;
  max_hr: number | null;
}

export interface HealthWorkoutsResponse {
  workouts: HealthWorkoutSummary[];
}

export interface DailyActivityPoint {
  date: string;
  minutes: number;
  kcal: number;
}

export interface DailyActivityResponse {
  days: DailyActivityPoint[];
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

export interface BackupConfigResponse {
  location: string;
  interval: string;
  last_backup: string | null;
}

export interface BackupConfigUpdate {
  interval?: string | null;
}

export interface BackupResultResponse {
  filename: string;
  path: string;
  size_bytes: number;
  table_counts: Record<string, number>;
}

export interface BackupFileResponse {
  filename: string;
  size_bytes: number;
  created_at: string;
  table_counts: Record<string, number>;
}

export interface RunEntryResponse {
  id: number;
  duration_seconds: number;
  distance_km: number;
  pace_per_km: number | null;
  run_type: string;
  date: string;
  notes: string;
  created_at: string;
}

export interface RunEntryCreate {
  duration_seconds: number;
  distance_km: number;
  run_type?: string;
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

// ─── Boxing Types ───────────────────────────────────────

export interface BoxingEntryResponse {
  id: number;
  duration_seconds: number;
  kcal_per_min: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface BoxingEntryCreate {
  duration_seconds: number;
  kcal_per_min?: number;
  date?: string;
  notes?: string;
}

export interface MonthlyBoxingStats {
  month: string;
  sessions: number;
  total_minutes: number;
}

export interface BoxingStatsResponse {
  total_sessions: number;
  total_duration_seconds: number;
  total_hours: number;
  avg_duration_seconds: number | null;
  avg_kcal_per_min: number | null;
  total_kcal_estimated: number;
  monthly_breakdown: MonthlyBoxingStats[];
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach auth token if stored
  const token = getStoredAuth();
  if (token) {
    headers["Authorization"] = `Basic ${token}`;
  }

  const doFetch = () =>
    fetch(`${API_BASE}${url}`, { ...options, headers });

  // One retry for network errors (offline, DNS, connection refused).
  // Don't retry 4xx/5xx — those are server-side issues.
  let res: Response;
  try {
    res = await doFetch();
  } catch {
    // Only retry if it looks like a network error, not an abort/timeout.
    await new Promise((r) => setTimeout(r, 1000));
    res = await doFetch();
  }

  // Handle 401 — clear auth and redirect to login
  if (res.status === 401) {
    clearStoredAuth();
    window.location.reload();
    throw new Error("Session expired");
  }

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
  getExerciseLogs: (exerciseId: number, limit = 10) =>
    fetchJSON<ExerciseLog[]>(
      `/api/v1/exercises/${exerciseId}/logs?limit=${limit}`,
    ),

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
  togglePin: (id: number, isPinned: boolean) =>
    fetchJSON<WorkoutTemplate>(`/api/v1/workouts/${id}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ is_pinned: isPinned }),
    }),
  duplicateWorkout: (id: number) =>
    fetchJSON<WorkoutTemplate>(`/api/v1/workouts/${id}/duplicate`, {
      method: "POST",
    }),

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
  updateSession: (id: number, data: { started_at?: string; notes?: string }) =>
    fetchJSON<WorkoutSession>(`/api/v1/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createExerciseLogs: (sessionId: number, seId: number, logs: ExerciseLogInput[]) =>
    fetchJSON<ExerciseLog[]>(
      `/api/v1/sessions/${sessionId}/exercises/${seId}/logs`,
      { method: "POST", body: JSON.stringify(logs) },
    ),

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

  // Personal Records
  getPrs: () => fetchJSON<PrsResponse>("/api/v1/health/prs"),

  // Stats
  getStatsOverview: () =>
    fetchJSON<StatsOverviewResponse>("/api/v1/stats/overview"),
  getDailyActivity: (days = 120) =>
    fetchJSON<DailyActivityResponse>(`/api/v1/stats/daily-activity?days=${days}`),


  // Apple Health insights (imported via /api/v1/import/data)
  getHealthInsights: (days = 120) =>
    fetchJSON<HealthInsightsResponse>(`/api/v1/import/insights?days=${days}`),
  getHealthWorkouts: (days = 120) =>
    fetchJSON<HealthWorkoutsResponse>(`/api/v1/import/workouts?days=${days}`),


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

  // ─── Boxing ─────────────────────────────────────────

  getBoxing: () => fetchJSON<BoxingEntryResponse[]>("/api/v1/boxing"),
  createBoxing: (data: BoxingEntryCreate) =>
    fetchJSON<BoxingEntryResponse>("/api/v1/boxing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBoxing: (id: number, data: BoxingEntryCreate) =>
    fetchJSON<BoxingEntryResponse>(`/api/v1/boxing/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBoxing: (id: number) =>
    fetchJSON<void>(`/api/v1/boxing/${id}`, { method: "DELETE" }),
  getBoxingStats: () =>
    fetchJSON<BoxingStatsResponse>("/api/v1/boxing/stats"),

  // ─── Notifications ─────────────────────────────────
  subscribePush: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    fetchJSON<{ status: string }>("/api/v1/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: (endpoint: string) =>
    fetchJSON<{ status: string }>(
      `/api/v1/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
      { method: "DELETE" },
    ),
  sendTestNotification: () =>
    fetchJSON<{ status: string; sent: number }>("/api/v1/notifications/send", {
      method: "POST",
    }),

  // ─── Backups ──────────────────────────────────────────

  getBackupConfig: () =>
    fetchJSON<BackupConfigResponse>("/api/v1/settings/backup"),
  updateBackupConfig: (data: BackupConfigUpdate) =>
    fetchJSON<BackupConfigResponse>("/api/v1/settings/backup", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createBackup: () =>
    fetchJSON<BackupResultResponse>("/api/v1/backup", { method: "POST" }),
  listBackups: () =>
    fetchJSON<BackupFileResponse[]>("/api/v1/backups"),
  restoreBackup: (filename: string) =>
    fetchJSON<{ status: string; safety_backup: string; table_counts: Record<string, number> }>(
      "/api/v1/backup/restore",
      { method: "POST", body: JSON.stringify({ filename }) },
    ),
};
