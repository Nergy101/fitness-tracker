// Cycling entry types and methods.

import { fetchJSON } from "./client";
import type { DailyActivityResponse } from "./stats";

export interface CyclingEntryResponse {
  id: number;
  duration_seconds: number;
  distance_km: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface CyclingEntryCreate {
  duration_seconds: number;
  distance_km: number;
  date?: string;
  notes?: string;
}

export interface MonthlyCyclingStats {
  month: string;
  sessions: number;
  total_minutes: number;
  total_km: number;
}

export interface CyclingStatsResponse {
  total_sessions: number;
  total_duration_seconds: number;
  total_hours: number;
  total_distance_km: number;
  avg_duration_seconds: number | null;
  avg_distance_km: number | null;
  total_kcal_estimated: number;
  monthly_breakdown: MonthlyCyclingStats[];
}

export const cyclingApi = {
  getCycling: () => fetchJSON<CyclingEntryResponse[]>("/api/v1/cycling"),
  createCycling: (data: CyclingEntryCreate) =>
    fetchJSON<CyclingEntryResponse>("/api/v1/cycling", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCycling: (id: number, data: CyclingEntryCreate) =>
    fetchJSON<CyclingEntryResponse>(`/api/v1/cycling/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCycling: (id: number) =>
    fetchJSON<void>(`/api/v1/cycling/${id}`, { method: "DELETE" }),
  getCyclingStats: () =>
    fetchJSON<CyclingStatsResponse>("/api/v1/cycling/stats"),
  getCyclingTrends: (days = 120) =>
    fetchJSON<DailyActivityResponse>(`/api/v1/cycling/stats/trends?days=${days}`),
};
