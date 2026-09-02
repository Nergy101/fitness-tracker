// Workout session types and methods.

import { fetchJSON, fetchJSONPage } from "./client";
import type { ExerciseLog, ExerciseLogInput } from "./exercises";

export interface SessionExercise {
  id: number;
  session_id: number;
  exercise_id: number | null;
  exercise_name: string;
  duration_seconds: number;
  kcal_burned: number;
  order_index: number;
  completed: boolean;
  image_url: string | null;
  logs: ExerciseLog[];
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
  boxing_entry_id: number | null;
  run_entry_id: number | null;
  cycling_entry_id: number | null;
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

export const sessionsApi = {
  getSessions: (params?: { limit?: number; offset?: number }) => {
    let url = "/api/v1/sessions";
    const qs: string[] = [];
    if (params?.limit !== undefined) qs.push(`limit=${params.limit}`);
    if (params?.offset !== undefined) qs.push(`offset=${params.offset}`);
    if (qs.length) url += `?${qs.join("&")}`;
    return fetchJSON<WorkoutSession[]>(url);
  },
  getSessionsPage: (limit: number, offset: number) =>
    fetchJSONPage<WorkoutSession>("/api/v1/sessions", limit, offset),
  getAllSessions: async (): Promise<WorkoutSession[]> => {
    const PAGE = 100;
    const all: WorkoutSession[] = [];
    let offset = 0;
    for (;;) {
      const page = await sessionsApi.getSessionsPage(PAGE, offset);
      all.push(...page.items);
      if (!page.hasMore || page.items.length === 0) break;
      offset += PAGE;
    }
    return all;
  },
  getSession: (id: number) =>
    fetchJSON<WorkoutSession>(`/api/v1/sessions/${id}`),
  createSession: (data: WorkoutSessionInput) =>
    fetchJSON<WorkoutSession>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSession: (id: number) =>
    fetchJSON<void>(`/api/v1/sessions/${id}`, { method: "DELETE" }),
  updateSession: (id: number, data: { started_at?: string; total_duration_seconds?: number; notes?: string }) =>
    fetchJSON<WorkoutSession>(`/api/v1/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createExerciseLogs: (sessionId: number, seId: number, logs: ExerciseLogInput[]) =>
    fetchJSON<ExerciseLog[]>(
      `/api/v1/sessions/${sessionId}/exercises/${seId}/logs`,
      { method: "POST", body: JSON.stringify(logs) },
    ),
};
