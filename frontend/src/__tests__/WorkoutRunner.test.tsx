import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import WorkoutRunner from "../components/WorkoutRunner";
import type { WorkoutTemplate } from "../api";

const mockCreateSession = vi.fn().mockResolvedValue({ id: 1, exercises: [] });
const mockUpdateSession = vi.fn().mockResolvedValue({});

vi.mock("../api", () => ({
  api: {
    getExercises: vi.fn().mockResolvedValue([]),
    getExerciseLogs: vi.fn().mockResolvedValue([]),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    updateSession: (...args: unknown[]) => mockUpdateSession(...args),
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

describe("WorkoutRunner", () => {
  const onFinish = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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

  it("calls onCancel when Stop is clicked", async () => {
    renderRunner();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByText("Stop"));
    expect(onCancel).toHaveBeenCalled();
  });
});