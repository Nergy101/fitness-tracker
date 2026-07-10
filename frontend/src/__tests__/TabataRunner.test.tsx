import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import TabataRunner from "../components/TabataRunner";
import { api } from "../api";
import type { WorkoutTemplate } from "../api";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../api", () => ({
  api: {
    createSession: vi.fn().mockResolvedValue({ id: 1, exercises: [] }),
  },
}));

vi.mock("../sound", () => ({
  soundTabata: vi.fn(),
  soundFinish: vi.fn(),
  // isMuted / setMuted intentionally absent — useAudio gets undefined (falsy),
  // which is fine; no mute-button interactions occur in these tests.
}));

// TopControls → useTheme → window.matchMedia, which jsdom does not implement.
// Render null instead; the controls are irrelevant to the state machine.
vi.mock("../components/TopControls", () => ({
  default: () => null,
}));

// ── Fixture ──────────────────────────────────────────────────────────────────
// rounds=2: segments = ready(3s) → work(20s) → rest(10s) → work(20s) → finished
// total_duration_seconds = 2*20 + 1*10 = 50

const workout: WorkoutTemplate = {
  id: 1,
  name: "Test Tabata",
  description: "Test workout",
  mode: "tabata",
  rounds: 2,
  rest_between_rounds: 0,
  time_cap_seconds: null,
  is_pinned: false,
  pinned_order: null,
  warmup_seconds: 0,
  cooldown_seconds: 0,
  work_duration_seconds: 20,
  rest_duration_seconds: 10,
  total_duration_seconds: 50,
  created_at: "2024-01-01T00:00:00",
  exercises: [
    {
      id: 1,
      template_id: 1,
      exercise_id: 1,
      duration_seconds: 20,
      rest_after_seconds: 10,
      order_index: 0,
      superset_group: null,
      exercise: {
        id: 1,
        name: "Push-ups",
        description: "Standard push-up",
        category: "strength",
        default_kcal_per_min: 5,
        default_duration_seconds: 20,
        image_url: null,
        created_at: "2024-01-01T00:00:00",
      },
    },
    {
      id: 2,
      template_id: 1,
      exercise_id: 2,
      duration_seconds: 20,
      rest_after_seconds: 10,
      order_index: 1,
      superset_group: null,
      exercise: {
        id: 2,
        name: "Squats",
        description: "Standard squat",
        category: "strength",
        default_kcal_per_min: 5,
        default_duration_seconds: 20,
        image_url: null,
        created_at: "2024-01-01T00:00:00",
      },
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Drive fake clock past a segment boundary (+100 ms of margin). */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Fast-forward through all four segments to reach the finished screen. */
async function advanceToFinished() {
  await advance(3100);  // ready (3 s) → work
  await advance(20100); // work  (20 s) → rest
  await advance(10100); // rest  (10 s) → work (round 2)
  await advance(20100); // work  (20 s) → finished
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("TabataRunner — rounds=2 state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Unmount while fake timers are still in effect so the useEffect cleanup
    // can call clearInterval on the correct (fake) interval ID.
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initial render shows 'Get ready' and 'Round 1/2'", () => {
    render(<TabataRunner workout={workout} onFinish={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Get ready")).toBeInTheDocument();
    expect(screen.getByText("Round 1/2")).toBeInTheDocument();
  });

  it("after 3 s ready phase → 'WORK' and 'Round 1/2'", async () => {
    render(<TabataRunner workout={workout} onFinish={vi.fn()} onCancel={vi.fn()} />);

    await advance(3100);

    expect(screen.getByText("WORK")).toBeInTheDocument();
    expect(screen.getByText("Round 1/2")).toBeInTheDocument();
  });

  it("after ready + 20 s work → 'REST' and 'Round 2/2'", async () => {
    render(<TabataRunner workout={workout} onFinish={vi.fn()} onCancel={vi.fn()} />);

    await advance(3100);
    await advance(20100);

    expect(screen.getByText("REST")).toBeInTheDocument();
    expect(screen.getByText("Round 2/2")).toBeInTheDocument();
  });

  it("after ready + work + 10 s rest → 'WORK' and 'Round 2/2'", async () => {
    render(<TabataRunner workout={workout} onFinish={vi.fn()} onCancel={vi.fn()} />);

    await advance(3100);
    await advance(20100);
    await advance(10100);

    expect(screen.getByText("WORK")).toBeInTheDocument();
    expect(screen.getByText("Round 2/2")).toBeInTheDocument();
  });

  it("after all rounds → finished screen shows 'Tabata Complete!'", async () => {
    render(<TabataRunner workout={workout} onFinish={vi.fn()} onCancel={vi.fn()} />);

    await advanceToFinished();

    expect(screen.getByText("Tabata Complete!")).toBeInTheDocument();
  });

  it("clicking 'Done' calls createSession once with correct args and fires onFinish", async () => {
    const onFinish = vi.fn();
    render(<TabataRunner workout={workout} onFinish={onFinish} onCancel={vi.fn()} />);

    await advanceToFinished();

    await act(async () => {
      fireEvent.click(screen.getByText("Done"));
    });

    // createSession called exactly once
    const mockCreate = vi.mocked(api.createSession);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const [callArg] = mockCreate.mock.calls[0];

    // Total duration: 2 rounds × 20 s work + 1 rest × 10 s = 50 s
    expect(callArg.total_duration_seconds).toBe(50);

    // One exercise entry per round
    expect(callArg.exercises).toHaveLength(2);

    callArg.exercises.forEach((ex, i: number) => {
      expect(ex.duration_seconds).toBe(20);
      expect(ex.order_index).toBe(i);
      expect(ex.completed).toBe(true);
    });

    // onFinish called after session is persisted
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
