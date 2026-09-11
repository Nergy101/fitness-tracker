export type Phase = "warmup" | "cooldown" | "rest" | "exercise" | "roundrest" | "finished";

export const DEFAULT_REST = 5;
export const DEFAULT_KCAL_PER_MIN = 5;
export const RING = 264;

export function kcalFor(durationSeconds: number, kcalPerMin: number): number {
  return (durationSeconds / 60) * kcalPerMin;
}

// exerciseLogs keys are `${round}-${index}`; split into the position they map to.
export function parseLogKey(key: string): { round: number; index: number } {
  const [round, index] = key.split("-").map(Number);
  return { round, index };
}

// Weight/reps validation
export function validateWeight(value: string): string | null {
  if (value === "" || value === "0") return null; // allow empty or bodyweight
  const n = parseFloat(value);
  if (isNaN(n)) return "Enter a number";
  if (n < 0) return "Weight can't be negative";
  if (n > 1000) return "That's a lot! Tap again to confirm";
  return null;
}

export function validateReps(value: string): string | null {
  if (value === "") return null;
  const n = parseInt(value, 10);
  if (isNaN(n)) return "Enter a number";
  if (n < 0) return "Reps can't be negative";
  if (n === 0) return "Reps must be at least 1";
  if (n > 200) return "That's a lot! Tap again to confirm";
  return null;
}
