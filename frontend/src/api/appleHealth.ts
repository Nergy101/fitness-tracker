// Apple Health import insights (imported via /api/v1/import/data).

import { fetchJSON } from "./client";

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

export interface MetricNameStat {
  metric_name: string;
  count: number;
  earliest: string | null;
  latest: string | null;
  latest_qty: number | null;
}

export interface MetricNamesResponse {
  metrics: MetricNameStat[];
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

export const appleHealthApi = {
  getHealthInsights: (days = 120) =>
    fetchJSON<HealthInsightsResponse>(`/api/v1/import/insights?days=${days}`),
  getHealthWorkouts: (days = 120) =>
    fetchJSON<HealthWorkoutsResponse>(`/api/v1/import/workouts?days=${days}`),
  getMetricNames: () =>
    fetchJSON<MetricNamesResponse>("/api/v1/import/metric-names"),
};
