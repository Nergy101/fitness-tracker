// Typed client for the FitnessTracker FastAPI backend.
// Mirrors backend/app/schemas.py.
//
// This module composes the per-domain API objects (see the sibling files in
// this directory) into a single `api` object, preserving the original flat
// shape so every existing call site (`api.getWorkouts()`, `api.createRun()`,
// etc.) keeps working unchanged.

import { logout } from "./client";
import { exercisesApi } from "./exercises";
import { workoutsApi } from "./workouts";
import { sessionsApi } from "./sessions";
import { healthApi } from "./health";
import { statsApi } from "./stats";
import { appleHealthApi } from "./appleHealth";
import { runsApi } from "./runs";
import { boxingApi } from "./boxing";
import { cyclingApi } from "./cycling";
import { injuriesApi } from "./injuries";
import { notificationsApi } from "./notifications";
import { backupApi } from "./backup";

export * from "./client";
export * from "./exercises";
export * from "./workouts";
export * from "./sessions";
export * from "./health";
export * from "./stats";
export * from "./appleHealth";
export * from "./runs";
export * from "./boxing";
export * from "./cycling";
export * from "./injuries";
export * from "./notifications";
export * from "./backup";

export const api = {
  ...exercisesApi,
  ...workoutsApi,
  ...sessionsApi,
  ...healthApi,
  ...statsApi,
  ...appleHealthApi,
  ...runsApi,
  ...boxingApi,
  ...cyclingApi,
  ...injuriesApi,
  ...notificationsApi,
  ...backupApi,
  logout,
};
