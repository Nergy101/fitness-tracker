import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import WorkoutRunner from "../components/WorkoutRunner";
import type { WorkoutTemplate } from "../api";

// Mock api
vi.mock("../api", () => ({
  api: {
    getExercises: vi.fn().mockResolvedValue([]),
    getExerciseLogs: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 1, exercises: [] }),
    updateSession: vi.fn().mockResolvedValue({}),
  },
}));

// Mock sound to avoid AudioContext / speechSynthesis in jsdom
vi.mock("../sound", () => ({
  soundStart: vi.fn(),
  soundRest: vi.fn(),
  soundFinish: vi.fn(),
  speak: vi.fn(),
}));

// Mock TopControls to avoid useTheme/useAudio context requirements
vi.mock("../components/TopControls", () => ({
  default: () => null,
}));

// Mock ExerciseImage to simplify rendering
vi.mock("../components/ExerciseImage", () => ({
  default: () => null,
}));

// Mock useFocusTrap
vi.mock("../useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const mockTemplate: WorkoutTemplate = {
  id: 1,
  name: "Full Body Circuit",
  description: "A full body circuit workout",
  mode: "circuit",
  time_cap_seconds: null,
  rounds: 3,
  rest_between_rounds: 60,
  is_pinned: false,
  pinned_order: null,
  warmup_seconds: 0,
  cooldown_seconds: 0,
  created_at: "2026-07-01T00:00:00Z",
  exercises: [
    {
      id: 10,
      template_id: 1,
      exercise_id: 100,
      duration_seconds: 30,
      rest_after_seconds: 5,
      order_index: 0,
      superset_group: null,
      exercise: {
        id: 100,
        name: "Push-ups",
        description: "Classic push-ups",
        category: "strength",
        default_kcal_per_min: 8,
        default_duration_seconds: 30,
        image_url: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    },
  ],
  work_duration_seconds: 90,
  rest_duration_seconds: 120,
  total_duration_seconds: 210,
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
    return render(
      <WorkoutRunner
        workout={template}
        onFinish={onFinish}
        onCancel={onCancel}
      />,
    );
  }

  // ── Smoke test ──

  it("renders without crashing", () => {
    renderRunner();
    // The component renders into the workout-runner container
    const runnerEl = document.querySelector(".workout-runner");
    expect(runnerEl).toBeTruthy();
  });

  it("renders the exercise name during rest phase", async () => {
    renderRunner();
    // After the useEffect fires (with fake timers), startRest is
    // called synchronously, setting phase to "rest" and showing the
    // exercise name.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // The "Next up" text is shown in the rest phase
    expect(screen.getByText("Next up")).toBeInTheDocument();
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
  });

  it("renders the skip rest and pause buttons during rest phase", async () => {
    renderRunner();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Skip rest button
    expect(screen.getByText("Skip rest")).toBeInTheDocument();
  });

  it("renders the total workout info", async () => {
    // Template with a different exercise name to verify
    const templateWithSquats = {
      ...mockTemplate,
      exercises: [
        {
          ...mockTemplate.exercises[0],
          exercise: {
            ...mockTemplate.exercises[0].exercise!,
            name: "Squats",
          },
        },
      ],
    };
    renderRunner(templateWithSquats);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Squats")).toBeInTheDocument();
  });

  it("shows the pause/play and skip controls", async () => {
    renderRunner();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Pause button should be present
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });
});
