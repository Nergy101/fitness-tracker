import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionDetail from "../components/history/SessionDetail";
import type { WorkoutSession } from "../api";

// Mock the API module — resolved relative to this test file: ../api -> src/api.ts
vi.mock("../api", () => ({
  api: {
    updateSession: vi.fn().mockResolvedValue({}),
    getSession: vi.fn().mockResolvedValue({}),
    getBoxing: vi.fn().mockResolvedValue([]),
    getRuns: vi.fn().mockResolvedValue([]),
    updateBoxing: vi.fn().mockResolvedValue({}),
    updateRun: vi.fn().mockResolvedValue({}),
  },
}));

// Mock useFocusTrap
vi.mock("../useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// Mock ExerciseImage (imported by SessionDetail as ../ExerciseImage)
vi.mock("../components/ExerciseImage", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// Mock format utilities
vi.mock("../format", () => ({
  formatDuration: (s: number) => `${s}s`,
  formatDateRelative: () => "2d ago",
  localISO: (v: string) => v + ":00",
}));

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 1,
    template_id: 10,
    template_name: "Morning Routine",
    started_at: "2026-07-25T08:00:00",
    finished_at: "2026-07-25T08:30:00",
    total_duration_seconds: 1800,
    total_kcal_estimated: 250,
    notes: "Felt great",
    boxing_entry_id: null,
    run_entry_id: null,
    cycling_entry_id: null,
    exercises: [
      {
        id: 101,
        session_id: 1,
        exercise_id: 5,
        exercise_name: "Push-ups",
        duration_seconds: 120,
        kcal_burned: 25,
        order_index: 0,
        completed: true,
        image_url: null,
        logs: [
          {
            id: 1001,
            session_exercise_id: 101,
            weight_kg: 0,
            reps: 15,
            set_number: 1,
            created_at: "2026-07-25T08:01:00",
          },
        ],
      },
      {
        id: 102,
        session_id: 1,
        exercise_id: 6,
        exercise_name: "Squats",
        duration_seconds: 180,
        kcal_burned: 40,
        order_index: 1,
        completed: true,
        image_url: null,
        logs: [],
      },
    ],
    ...overrides,
  };
}

describe("SessionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Smoke tests ──────────────────────────────────────────

  it("renders the session name and stats", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    expect(screen.getByText("1800s")).toBeInTheDocument(); // formatDuration
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // exercise count (also in order index)
    expect(screen.getByText("250")).toBeInTheDocument(); // kcal
  });

  it("renders exercise list with names and durations", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    expect(screen.getByText("Squats")).toBeInTheDocument();
    expect(screen.getByText("120s")).toBeInTheDocument();
  });

  it("renders exercise logs with weight and reps", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.getByText("0kg × 15r")).toBeInTheDocument();
  });

  it("renders the notes field with existing notes", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const notesTextarea = screen.getByPlaceholderText("Add notes...");
    expect(notesTextarea).toBeInTheDocument();
    expect(notesTextarea).toHaveValue("Felt great");
  });

  it("renders the date input", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const dateInput = screen.getByDisplayValue("2026-07-25T08:00");
    expect(dateInput).toBeInTheDocument();
  });

  it("renders the relative time label", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  // ── Key interactions ─────────────────────────────────────

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const session = makeSession();
    render(<SessionDetail session={session} onClose={onClose} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("prompts before closing when there are unsaved changes", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    const session = makeSession();
    render(<SessionDetail session={session} onClose={onClose} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const notesTextarea = screen.getByPlaceholderText("Add notes...");
    fireEvent.change(notesTextarea, { target: { value: "Edited but not saved" } });

    fireEvent.click(screen.getByText("×"));
    expect(confirmSpy).toHaveBeenCalledWith("You have unsaved changes. Discard them?");
    expect(onClose).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("closes after confirming when there are unsaved changes", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onClose = vi.fn();
    const session = makeSession();
    render(<SessionDetail session={session} onClose={onClose} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const notesTextarea = screen.getByPlaceholderText("Add notes...");
    fireEvent.change(notesTextarea, { target: { value: "Edited but not saved" } });

    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("closes without prompting after saving", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    const onUpdate = vi.fn();
    const session = makeSession();
    const { rerender } = render(<SessionDetail session={session} onClose={onClose} onUpdate={onUpdate} onStartWorkout={vi.fn()} />);

    const notesTextarea = screen.getByPlaceholderText("Add notes...");
    fireEvent.change(notesTextarea, { target: { value: "Saved notes" } });
    fireEvent.click(screen.getByText("Save"));

    // Parent receives the updated session and passes it back down — notes are no longer dirty.
    await screen.findByText("Saved notes");
    rerender(<SessionDetail session={{ ...session, notes: "Saved notes" }} onClose={onClose} onUpdate={onUpdate} onStartWorkout={vi.fn()} />);

    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("shows save button when notes are modified", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const notesTextarea = screen.getByPlaceholderText("Add notes...");
    fireEvent.change(notesTextarea, { target: { value: "Updated notes" } });

    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows duration edit section for regular workouts", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const durationInput = screen.getByLabelText("Session duration minutes");
    expect(durationInput).toBeInTheDocument();
    expect(durationInput).toHaveValue(30); // 1800s / 60 = 30
  });

  it("shows Save button when duration is modified", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const durationInput = screen.getByLabelText("Session duration minutes");
    fireEvent.change(durationInput, { target: { value: "45" } });

    // Duration section should show a Save button
    const saveButtons = screen.getAllByText("Save");
    expect(saveButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show duration edit section for Run sessions", () => {
    const session = makeSession({ template_name: "Run: 5.0km" });
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.queryByLabelText("Session duration minutes")).not.toBeInTheDocument();
  });

  it("does not show duration edit section for Boxing sessions", () => {
    const session = makeSession({ template_name: "Boxing: Heavy Bag" });
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.queryByLabelText("Session duration minutes")).not.toBeInTheDocument();
  });

  it("renders run/walk toggle buttons for Run sessions", () => {
    const session = makeSession({ template_name: "Run: 5.0km" });
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const runButtons = screen.getAllByText("Run");
    expect(runButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Walk")).toBeInTheDocument();
  });

  it("has the correct aria-modal dialog role", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Morning Routine");
  });

  it("renders kcal for each exercise", () => {
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    expect(screen.getByText("25 kcal")).toBeInTheDocument();
    expect(screen.getByText("40 kcal")).toBeInTheDocument();
  });

  // ── Save flows ──

  it("saves notes on blur when modified", async () => {
    const onUpdate = vi.fn();
    const { api } = await import("../api");
    const session = makeSession();
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={onUpdate} onStartWorkout={vi.fn()} />);

    const textarea = screen.getByPlaceholderText("Add notes...");
    fireEvent.change(textarea, { target: { value: "New notes value" } });
    fireEvent.blur(textarea);

    await vi.waitFor(() => {
      expect(api.updateSession).toHaveBeenCalledWith(1, expect.objectContaining({ notes: "New notes value" }));
    });
  });

  it("saves duration on blur when modified", async () => {
    const session = makeSession({ boxing_entry_id: null, run_entry_id: null, template_name: "Morning Routine" });
    const { api } = await import("../api");
    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    const durInput = screen.getByLabelText("Session duration minutes");
    fireEvent.change(durInput, { target: { value: "20" } });
    fireEvent.blur(durInput);

    await vi.waitFor(() => {
      expect(api.updateSession).toHaveBeenCalledWith(1, expect.objectContaining({ total_duration_seconds: 1200 }));
    });
  });

  it("shows boxing edit fields when session has boxing_entry_id", async () => {
    const { api } = await import("../api");
    vi.mocked(api.getBoxing).mockResolvedValue([{
      id: 5, duration_seconds: 1800, kcal_per_min: 12, rounds: 10,
      date: "2026-07-25", notes: "", created_at: "2026-07-25T00:00:00Z",
    }]);

    const session = makeSession({
      template_name: "Boxing: 30min",
      run_entry_id: null,
      boxing_entry_id: 5,
    });

    render(<SessionDetail session={session} onClose={vi.fn()} onUpdate={vi.fn()} onStartWorkout={vi.fn()} />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Boxing minutes")).toBeInTheDocument();
    });
  });

  it("shows Repeat Workout for a regular session and starts it on click", () => {
    const session = makeSession();
    const onStartWorkout = vi.fn();
    render(
      <SessionDetail
        session={session}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onStartWorkout={onStartWorkout}
      />,
    );
    fireEvent.click(screen.getByText("Repeat Workout"));
    expect(onStartWorkout).toHaveBeenCalled();
    const started = onStartWorkout.mock.calls[0][0];
    expect(started.exercises.map((e: { exercise_name?: string; exercise: { name: string } | null }) => e.exercise?.name)).toEqual(["Push-ups", "Squats"]);
  });

  it("does not show Repeat Workout for mirror sessions", () => {
    const session = makeSession({ template_name: "Run: 5.0km" });
    render(
      <SessionDetail
        session={session}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onStartWorkout={vi.fn()}
      />,
    );
    expect(screen.queryByText("Repeat Workout")).toBeNull();
  });
});