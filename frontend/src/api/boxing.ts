// Boxing entry types and methods.

import { fetchJSON } from "./client";
import type { DailyActivityResponse } from "./stats";

export interface BoxingEntryResponse {
  id: number;
  duration_seconds: number;
  kcal_per_min: number;
  rounds: number | null;
  date: string;
  notes: string;
  created_at: string;
}

export interface BoxingEntryCreate {
  duration_seconds: number;
  kcal_per_min?: number;
  rounds?: number | null;
  date?: string;
  notes?: string;
}

export interface MonthlyBoxingStats {
  month: string;
  sessions: number;
  total_minutes: number;
  total_rounds: number;
}

export interface BoxingStatsResponse {
  total_sessions: number;
  total_duration_seconds: number;
  total_hours: number;
  avg_duration_seconds: number | null;
  avg_kcal_per_min: number | null;
  avg_rounds: number | null;
  total_kcal_estimated: number;
  monthly_breakdown: MonthlyBoxingStats[];
}

export interface BoxingPrsResponse {
  longest_session_seconds: number | null;
  most_kcal_session: number | null;
  total_hours_all_time: number;
  most_rounds_session: number | null;
}

export const boxingApi = {
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
  getBoxingPrs: () =>
    fetchJSON<BoxingPrsResponse>("/api/v1/boxing/prs"),
  getBoxingTrends: (days = 120) =>
    fetchJSON<DailyActivityResponse>(`/api/v1/boxing/stats/trends?days=${days}`),
};
