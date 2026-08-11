import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import WorkoutRunner from "../components/WorkoutRunner";
import type { WorkoutTemplate } from "../api";

const mockCreateSession = vi.fn().mockResolvedValue({
  id: 1,
  exercises: [{ id: 5, order_index: 0, exercise_id: 100, exercise_name: "Push-ups", duration_seconds: 5, kcal_burned: 0, completed: true }],
});
const mockUpdateSession = vi.fn().mockResolvedValue({});
const mockGetExerciseLogs = vi.fn().mockResolvedValue([]);
const mockCreateExerciseLogs = vi.fn().mockResolvedValue([]);

vi.mock("../api", () => ({
  api: {
    getExercises: vi.fn().mockResolvedValue([]),
    getExerciseLogs: (...args: unknown[]) => mockGetExerciseLogs(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    updateSession: (...args: unknown[]) => mockUpdateSession(...args),
    createExerciseLogs: (...args: unknown[]) => mockCreateExerciseLogs(...args),
  },
}));

vi.mock("../sound", () => ({
  soundStart: vi.fn(),
  soundRest: vi.fn(),
  soundFinish: vi.fn(),
  speak: vi.fn(),
}));

vi.mock("../components/TopControls", () => ({ default: () => null }));
vi.mock("../components/ExerciseImage", () => ({ default: () => null }));
vi.mock("../useFocusTrap", () => ({ useFocusTrap: vi.fn() }));

const mockTemplate: WorkoutTemplate = {
  id: 1, name: "Circuit", description: "", mode: "circuit",
  time_cap_seconds: null, rounds: 2, rest_between_rounds: 10,
  is_pinned: false, pinned_order: null,
  warmup_seconds: 0, cooldown_seconds: 0,
  created_at: "2026-07-01T00:00:00Z",
  exercises: [{
    id: 10, template_id: 1, exercise_id: 100, duration_seconds: 5,
    rest_after_seconds: 5, order_index: 0, superset_group: null,
    exercise: { id: 100, name: "Push-ups", description: "", category: "strength", default_kcal_per_min: 8, default_duration_seconds: 30, image_url: null, created_at: "" },
  }],
  work_duration_seconds: 90, rest_duration_seconds: 120, total_duration_seconds: 30,
};

const twoExerciseTemplate: WorkoutTemplate = {
  ...mockTemplate,
  exercises: [
    mockTemplate.exercises[0],
    {
      id: 11, template_id: 1, exercise_id: 101, duration_seconds: 5,
      rest_after_seconds: 5, order_index: 1, superset_group: null,
      exercise: { id: 101, name: "Squats", description: "", category: "strength", default_kcal_per_min: 8, default_duration_seconds: 30, image_url: null, created_at: "" },
    },
  ],
};

function weightInput() {
  return screen.getByLabelText("Weight in kg") as HTMLInputElement;
}
function repsInput() {
  return screen.getByLabelText("Reps") as HTMLInputElement;
}
describe("WorkoutRunner", () => {
  const onFinish = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetExerciseLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderRunner(template = mockTemplate) {
    return render(<WorkoutRunner workout={template} onFinish={onFinish} onCancel={onCancel} />);
  }

  it("renders without crashing", () => {
    renderRunner();
    expect(document.querySelector(".workout-runner")).toBeTruthy();
  });

  it("shows Next up during initial rest phase", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Next up")).toBeInTheDocument();
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
  });

  it("shows Skip rest and Pause buttons", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Skip rest")).toBeInTheDocument();
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });

  it("transitions from rest to active phase", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // Advance past the initial rest phase (5s rest_after)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    // Should now show the exercise timer
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
  });

  it("shows Undo last set after a set is logged and clears it on click", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    // No undo button before anything is logged.
    expect(screen.queryByRole("button", { name: "Undo last set" })).toBeNull();
    // Log a set (weight + reps) on the current exercise.
    fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "10" } });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Undo last set" })).toBeInTheDocument();
    // Undo removes the set and hides the button.
    fireEvent.click(screen.getByRole("button", { name: "Undo last set" }));
    await act(async () => {});
    expect((screen.getByLabelText("Weight in kg") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Reps") as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: "Undo last set" })).toBeNull();
  });

  it("navigates back to the previous exercise when undoing after advancing", async () => {
    renderRunner(twoExerciseTemplate);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    // Log a set on exercise 0 (Push-ups).
    fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "80" } });
    await act(async () => {});
    // Advance to the next exercise (rest -> exercise 1).
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByText("Skip rest"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Squats")).toBeInTheDocument();
    // Undo pops back to the exercise whose set we just logged.
    fireEvent.click(screen.getByRole("button", { name: "Undo last set" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    expect((screen.getByLabelText("Weight in kg") as HTMLInputElement).value).toBe("");
  });

  it("calls onCancel when Stop is clicked", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByText("Stop"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("pre-fills weight/reps with the values from the previous round (NER-210)", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // Enter the first exercise round
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    fireEvent.change(weightInput(), { target: { value: "80" } });
    fireEvent.change(repsInput(), { target: { value: "10" } });
    // Finish round 1 (5s exercise), pass round rest (10s), enter round 2
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(weightInput().value).toBe("80");
    expect(repsInput().value).toBe("10");
  });

  it("pre-fills the first set of a new exercise from the most recent history log (NER-210)", async () => {
    mockGetExerciseLogs.mockResolvedValue([
      { id: 1, session_exercise_id: 5, weight_kg: 60, reps: 12, set_number: 1, created_at: "2026-07-01T00:00:00Z" },
    ]);
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(weightInput().value).toBe("60");
    expect(repsInput().value).toBe("12");
  });

  it("clears the fields when moving to a new exercise (NER-210)", async () => {
    renderRunner(twoExerciseTemplate);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // First exercise round
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    fireEvent.change(weightInput(), { target: { value: "80" } });
    fireEvent.change(repsInput(), { target: { value: "10" } });
    // Finish exercise 1 (5s) + rest (5s) -> exercise 2
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    // New exercise (no history, no session values) -> blank fields
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(weightInput().value).toBe("");
    expect(repsInput().value).toBe("");
  });

  it("does not save an auto-committed set when the exercise is skipped (NER-210)", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // Round 1: log 80x10
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    fireEvent.change(weightInput(), { target: { value: "80" } });
    fireEvent.change(repsInput(), { target: { value: "10" } });
    // Round 2 starts with auto-committed prefill; user skips it
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    // Finish (cooldown 0 -> finished) and let the save flush
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mockCreateExerciseLogs).toHaveBeenCalledTimes(1);
    // Only the round-1 set survives; the skipped round-2 prefill was dropped
    expect(mockCreateExerciseLogs).toHaveBeenCalledWith(
      1, 5,
      [{ weight_kg: 80, reps: 10, set_number: 1 }],
    );
  });
});
