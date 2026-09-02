// Injury marker types and methods.

import { fetchJSON } from "./client";

export interface InjuryMarkerResponse {
  id: number;
  date: string;
  body_part: string;
  severity: number;
  notes: string;
  resolved_date: string | null;
  created_at: string;
}

export interface InjuryMarkerCreate {
  date?: string;
  body_part: string;
  severity?: number;
  notes?: string;
  resolved_date?: string | null;
}

export interface InjuryMarkerUpdate {
  date?: string;
  body_part?: string;
  severity?: number;
  notes?: string;
  resolved_date?: string | null;
}

export const injuriesApi = {
  getInjuries: (activeOnly = false) => {
    const qs = activeOnly ? "?active_only=true" : "";
    return fetchJSON<InjuryMarkerResponse[]>(`/api/v1/health/injuries${qs}`);
  },
  getActiveInjuries: () =>
    fetchJSON<InjuryMarkerResponse[]>("/api/v1/health/injuries/active"),
  getInjury: (id: number) =>
    fetchJSON<InjuryMarkerResponse>(`/api/v1/health/injuries/${id}`),
  createInjury: (data: InjuryMarkerCreate) =>
    fetchJSON<InjuryMarkerResponse>("/api/v1/health/injuries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInjury: (id: number, data: InjuryMarkerUpdate) =>
    fetchJSON<InjuryMarkerResponse>(`/api/v1/health/injuries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteInjury: (id: number) =>
    fetchJSON<void>(`/api/v1/health/injuries/${id}`, { method: "DELETE" }),
};
