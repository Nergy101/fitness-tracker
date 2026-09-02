// Workout template types and methods.

import { fetchJSON } from "./client";
import type { Exercise } from "./exercises";

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

export const workoutsApi = {
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
};
