// Run entry types and methods.

import { fetchJSON } from "./client";

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

export const runsApi = {
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
