// Typed client for the FitnessTracker FastAPI backend.
//
// The implementation lives in ./api/ (split by domain: workouts, health,
// runs, boxing, cycling, sessions, stats, etc. — see ./api/index.ts). This
// file re-exports everything so existing `from "./api"` / `from "../api"`
// imports keep working unchanged.
export * from "./api/index";
