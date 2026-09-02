// Health profile, weight, measurements, wellness, BMI/score, and PR types
// and methods.

import { fetchJSON } from "./client";

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
  // Boxing
  longest_boxing_seconds: number | null;
  most_kcal_boxing: number | null;
  total_boxing_hours: number;
  // Cycling
  longest_cycling_seconds: number | null;
  longest_cycling_km: number | null;
  most_kcal_cycling: number | null;
  total_cycling_hours: number;
  // Overall
  longest_streak_days: number;
  streak_days_30d: number;
  // Strength (per-exercise estimated one-rep max)
  best_1rm_per_exercise: {
    exercise_id: number | null;
    exercise_name: string;
    estimated_1rm_kg: number;
    weight_kg: number | null;
    reps: number | null;
    date: string;
  }[];
}

export interface HealthScoreResponse {
  score: number;
  bmi_score: number;
  workout_score: number;
  streak_score: number;
  measurement_score: number;
  spotlight: string;
}

export const healthApi = {
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
};
