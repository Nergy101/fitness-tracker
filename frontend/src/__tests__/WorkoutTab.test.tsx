import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import WorkoutTab from "../components/WorkoutTab";
import type { WorkoutTemplate, Exercise } from "../api";

// Hoist mutable references so vi.mock factories can access them.
const mockGetWorkoutsImpl = vi.fn<() => Promise<WorkoutTemplate[]>>();
const mockTogglePinImpl = vi.fn<(id: number, pinned: boolean) => Promise<WorkoutTemplate>>();
const mockDeleteWorkoutImpl = vi.fn<(id: number) => Promise<unknown>>();
const mockDuplicateWorkoutImpl = vi.fn<(id: number) => Promise<WorkoutTemplate>>();
const mockCreateSessionImpl = vi.fn<(data: unknown) => Promise<unknown>>();

// Mock the api module — data must be inlined since vi.mock factories are hoisted
vi.mock("../api", () => ({
  api: {
    getWorkouts: vi.fn().mockImplementation(() => mockGetWorkoutsImpl()),
    getExercises: vi.fn().mockResolvedValue([]),
    getStatsOverview: vi.fn().mockResolvedValue({
      consistency_score_pct: 80,
      avg_weight_change_kg: 0.5,
    }),
    getPrs: vi.fn().mockResolvedValue({ streak_days_30d: 3 }),
    togglePin: vi.fn().mockImplementation((...args: unknown[]) => mockTogglePinImpl(args[0] as number, args[1] as boolean)),
    deleteWorkout: vi.fn().mockImplementation((...args: unknown[]) => mockDeleteWorkoutImpl(args[0] as number)),
    duplicateWorkout: vi.fn().mockImplementation((...args: unknown[]) => mockDuplicateWorkoutImpl(args[0] as number)),
    createSession: vi.fn().mockImplementation((...args: unknown[]) => mockCreateSessionImpl(args[0])),
  },
  OfflineError: class OfflineError extends Error {
    readonly offline = true;
    constructor(message = "Offline") {
      super(message);
      this.name = "OfflineError";
    }
  },
}));

// Mock heavy/child components so tests focus on WorkoutTab logic.
vi.mock("../components/RunLogger", () => ({
  default: ({ runType }: { runType: string }) => <div data-testid={`run-logger-${runType}`} />,
}));

vi.mock("../components/CyclingLogger", () => ({
  default: () => <div data-testid="cycling-logger" />,
}));

vi.mock("../components/BoxingLogger", () => ({
  default: () => <div data-testid="boxing-logger" />,
}));

vi.mock("../components/WorkoutEditor", () => ({
  default: () => <div data-testid="workout-editor">Editor</div>,
}));

vi.mock("../components/skeletons/WorkoutSkeleton", () => ({
  default: () => <div data-testid="workout-skeleton">Loading...</div>,
}));

vi.mock("../components/Toast", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div role="status">{children}</div>
  ),
}));

vi.mock("../components/WorkoutCard", () => ({
  default: ({
    template,
    onStart,
    onEdit,
    onClone,
    onDelete,
    onLog,
    onTogglePin,
  }: {
    template: WorkoutTemplate;
    onStart: (t: WorkoutTemplate) => void;
    onEdit: (t: WorkoutTemplate) => void;
    onClone: (t: WorkoutTemplate) => void;
    onDelete: (id: number, name: string) => void;
    onLog: (t: WorkoutTemplate) => void;
    onTogglePin: (t: WorkoutTemplate) => void;
  }) => (
    <div data-testid={`workout-card-${template.id}`}>
      <h3>{template.name}</h3>
      <button aria-label={`pin-${template.id}`} onClick={() => onTogglePin(template)}>
        Pin
      </button>
      <button aria-label={`delete-${template.id}`} onClick={() => onDelete(template.id, template.name)}>
        Del
      </button>
      <button aria-label={`duplicate-${template.id}`} onClick={() => onClone(template)}>
        Dup
      </button>
      <button aria-label={`log-${template.id}`} onClick={() => onLog(template)}>
        Log
      </button>
      <button aria-label={`start-${template.id}`} onClick={() => onStart(template)}>
        Start
      </button>
      <button aria-label={`edit-${template.id}`} onClick={() => onEdit(template)}>
        Edit
      </button>
    </div>
  ),
}));

vi.mock("../useFocusTrap", () => ({ useFocusTrap: vi.fn() }));

const mockExercise: Exercise = {
  id: 100,
  name: "Push-ups",
  description: "",
  category: "strength",
  default_kcal_per_min: 8,
  default_duration_seconds: 30,
  image_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockTemplate: WorkoutTemplate = {
  id: 1,
  name: "Full Body",
  description: "",
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
      rest_after_seconds: 0,
      order_index: 0,
      superset_group: null,
      exercise: mockExercise,
    },
  ],
  work_duration_seconds: 90,
  rest_duration_seconds: 120,
  total_duration_seconds: 210,
};

describe("WorkoutTab", () => {
  const onStartWorkout = vi.fn();
  const onLogWorkout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkoutsImpl.mockResolvedValue([mockTemplate]);
    mockTogglePinImpl.mockImplementation(async (id, pinned) => ({ ...mockTemplate, id, is_pinned: pinned }));
    mockDeleteWorkoutImpl.mockResolvedValue({});
    mockDuplicateWorkoutImpl.mockImplementation(async (id) => ({ ...mockTemplate, id, name: "Full Body (Copy)" }));
    mockCreateSessionImpl.mockResolvedValue({});
  });

  function renderTab() {
    return render(
      <WorkoutTab onStartWorkout={onStartWorkout} onLogWorkout={onLogWorkout} />,
    );
  }

  it("renders templates after loading", async () => {
    renderTab();
    // Loading skeleton first
    expect(screen.getByTestId("workout-skeleton")).toBeInTheDocument();
    // Then the template appears
    expect(await screen.findByText("Full Body")).toBeInTheDocument();
    // Quick-log row rendered after load
    expect(screen.getByTestId("run-logger-run")).toBeInTheDocument();
    expect(screen.getByTestId("cycling-logger")).toBeInTheDocument();
    expect(screen.getByTestId("boxing-logger")).toBeInTheDocument();
  });

  it("renders empty state when no templates exist", async () => {
    mockGetWorkoutsImpl.mockResolvedValue([]);
    renderTab();
    expect(
      await screen.findByText("No workout templates yet"),
    ).toBeInTheDocument();
  });

  it("renders error state when loading fails", async () => {
    mockGetWorkoutsImpl.mockRejectedValue(new Error("boom"));
    renderTab();
    expect(await screen.findByText("Failed to load workouts")).toBeInTheDocument();
  });

  it("pin toggle calls api.togglePin and shows a toast", async () => {
    renderTab();
    await screen.findByText("Full Body");
    fireEvent.click(screen.getByLabelText("pin-1"));
    await waitFor(() => {
      expect(mockTogglePinImpl).toHaveBeenCalled();
    });
    expect(await screen.findByText("Workout pinned")).toBeInTheDocument();
  });

  it("delete flow: confirm modal then calls api.deleteWorkout", async () => {
    renderTab();
    await screen.findByText("Full Body");
    fireEvent.click(screen.getByLabelText("delete-1"));
    // Confirm modal appears
    expect(screen.getByRole("dialog", { name: "Delete workout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockDeleteWorkoutImpl).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText('"Full Body" deleted')).toBeInTheDocument();
    // Template removed from list
    expect(screen.queryByText("Full Body")).not.toBeInTheDocument();
  });

  it("duplicate calls api.duplicateWorkout and prepends the clone", async () => {
    renderTab();
    await screen.findByText("Full Body");
    fireEvent.click(screen.getByLabelText("duplicate-1"));
    await waitFor(() => {
      expect(mockDuplicateWorkoutImpl).toHaveBeenCalledWith(1);
    });
    expect(await screen.findByText("Full Body (Copy)")).toBeInTheDocument();
    expect(screen.getByText('Duplicated as "Full Body (Copy)"')).toBeInTheDocument();
  });

  it("log workout calls api.createSession and fires onLogWorkout", async () => {
    renderTab();
    await screen.findByText("Full Body");
    fireEvent.click(screen.getByLabelText("log-1"));
    await waitFor(() => {
      expect(mockCreateSessionImpl).toHaveBeenCalled();
    });
    expect(await screen.findByText("Workout logged!")).toBeInTheDocument();
    expect(onLogWorkout).toHaveBeenCalled();
  });

  it("start workout fires onStartWorkout", async () => {
    renderTab();
    await screen.findByText("Full Body");
    fireEvent.click(screen.getByLabelText("start-1"));
    expect(onStartWorkout).toHaveBeenCalledWith(mockTemplate);
  });
});
