// Cross-activity stats overview & daily/weekly activity aggregates.

import { fetchJSON } from "./client";

export interface VolumePoint {
  date: string;
  exercise_id: number | null;
  exercise_name: string;
  total_kg: number;
  sets: number;
  avg_weight: number | null;
  max_weight: number | null;
}

export interface WeeklyActivityStat {
  week_start: string;
  workout_minutes: number;
  run_minutes: number;
  walk_minutes: number;
  boxing_minutes: number;
  cycling_minutes: number;
  run_km: number;
  walk_km: number;
  cycling_km: number;
  workout_kcal: number;
  run_kcal: number;
  walk_kcal: number;
  boxing_kcal: number;
  cycling_kcal: number;
}

export interface StatsOverviewResponse {
  activity_weekly: WeeklyActivityStat[];
  total_kcal_burned: number;
  consistency_score_pct: number;
  consistency_days_at_100: number;
  total_sessions_all: number;
  total_runs: number;
  total_walks: number;
  total_boxing: number;
  total_cycling: number;
  current_month_minutes: number;
  previous_month_minutes: number;
  current_month_vs_previous_pct: number | null;
  avg_weight_change_kg: number | null;
}

export interface DailyActivityPoint {
  date: string;
  minutes: number;
  kcal: number;
}

export interface DailyActivityResponse {
  days: DailyActivityPoint[];
}

export const statsApi = {
  getStatsOverview: () =>
    fetchJSON<StatsOverviewResponse>("/api/v1/stats/overview"),
  getDailyActivity: (days = 120) =>
    fetchJSON<DailyActivityResponse>(`/api/v1/stats/daily-activity?days=${days}`),
  getVolume: (exerciseId?: number, days = 30) => {
    const params = new URLSearchParams({ days: String(days) });
    if (exerciseId != null) params.set("exercise_id", String(exerciseId));
    return fetchJSON<VolumePoint[]>(`/api/v1/stats/volume?${params.toString()}`);
  },
};
