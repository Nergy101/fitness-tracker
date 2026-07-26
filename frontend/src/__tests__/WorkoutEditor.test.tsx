import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WorkoutEditor from "../components/WorkoutEditor";
import type { WorkoutTemplate, Exercise } from "../api";

const mockCreateWorkout = vi.fn().mockResolvedValue({ id: 99 });
const mockUpdateWorkout = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("../api", () => ({
  api: {
    createWorkout: (...args: unknown[]) => mockCreateWorkout(...args),
    updateWorkout: (...args: unknown[]) => mockUpdateWorkout(...args),
  },
}));

const mockExercise: Exercise = {
  id: 100,
  name: "Push-ups",
  description: "Classic push-ups",
  category: "strength",
  default_kcal_per_min: 8,
  default_duration_seconds: 30,
  image_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockExercise2: Exercise = {
  id: 101,
  name: "Squats",
  description: "Bodyweight squats",
  category: "strength",
  default_kcal_per_min: 10,
  default_duration_seconds: 30,
  image_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockTemplate: WorkoutTemplate = {
  id: 1,
  name: "Full Body Circuit",
  description: "A challenging full body workout",
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

describe("WorkoutEditor", () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const allExercises = [mockExercise, mockExercise2];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderEditor(workout: WorkoutTemplate | null = null) {
    return render(
      <WorkoutEditor
        workout={workout}
        exercises={allExercises}
        onSave={onSave}
        onClose={onClose}
      />,
    );
  }

  // ── Smoke tests ──

  it("renders with heading 'New Workout' when no template provided", () => {
    renderEditor(null);
    expect(screen.getByText("New Workout")).toBeInTheDocument();
  });

  it("renders workout name in heading when editing existing template", () => {
    renderEditor(mockTemplate);
    expect(screen.getByText("Full Body Circuit")).toBeInTheDocument();
  });

  // ── Form fields ──

  it("renders name input with placeholder", () => {
    renderEditor(null);
    const nameInput = screen.getByPlaceholderText("Workout name...");
    expect(nameInput).toBeInTheDocument();
  });

  it("prefills name input when editing an existing template", () => {
    renderEditor(mockTemplate);
    const nameInput = screen.getByDisplayValue("Full Body Circuit");
    expect(nameInput).toBeInTheDocument();
  });

  it("renders description textarea", () => {
    renderEditor(null);
    expect(
      screen.getByPlaceholderText("Description (optional)..."),
    ).toBeInTheDocument();
  });

  // ── Mode selector ──

  it("renders mode selector with Circuit, AMRAP, EMOM, Tabata options", () => {
    renderEditor(null);
    expect(screen.getByText("Circuit")).toBeInTheDocument();
    expect(screen.getByText("AMRAP")).toBeInTheDocument();
    expect(screen.getByText("EMOM")).toBeInTheDocument();
    expect(screen.getByText("Tabata")).toBeInTheDocument();
  });

  it("shows rounds stepper in circuit mode", () => {
    renderEditor(null);
    expect(screen.getByText("Rounds")).toBeInTheDocument();
  });

  it("shows time cap options when AMRAP is selected", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("AMRAP"));
    expect(screen.getByText(/Time Cap/)).toBeInTheDocument();
    expect(screen.getByText("5 min")).toBeInTheDocument();
    expect(screen.getByText("10 min")).toBeInTheDocument();
  });

  it("shows EMOM info when EMOM is selected", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("EMOM"));
    // EMOM text appears in multiple places (button label, info paragraph, footer)
    const emomElements = screen.getAllByText(/EMOM/);
    expect(emomElements.length).toBeGreaterThanOrEqual(2);
  });

  // ── Exercise management ──

  it("renders 'Add Exercise' button", () => {
    renderEditor(null);
    expect(screen.getByText("Add Exercise")).toBeInTheDocument();
  });

  it("shows exercise picker when Add Exercise is clicked", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("Add Exercise"));
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("adds an exercise to the editor when selected from picker", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("Add Exercise"));
    // Click on Push-ups in the picker
    fireEvent.click(screen.getByText("Push-ups"));
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    // Picker should close
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("shows empty state when no exercises are added", () => {
    render(
      <WorkoutEditor
        workout={null}
        exercises={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByText("Add exercises to build your workout"),
    ).toBeInTheDocument();
  });

  // ── Close behavior ──

  it("calls onClose when the close button (×) is clicked", () => {
    renderEditor(null);
    const closeBtn = screen.getByText("×");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    renderEditor(null);
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  // ── Save ──

  it("has a 'Save Workout' button", () => {
    renderEditor(null);
    expect(screen.getByText("Save Workout")).toBeInTheDocument();
  });

  it("Save button is disabled when name is empty", () => {
    renderEditor(null);
    const saveBtn = screen.getByText("Save Workout");
    expect(saveBtn).toBeDisabled();
  });

  it("Save button is enabled when name is filled", () => {
    renderEditor(null);
    const nameInput = screen.getByPlaceholderText("Workout name...");
    fireEvent.change(nameInput, { target: { value: "My Workout" } });
    const saveBtn = screen.getByText("Save Workout");
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls api.createWorkout for new template on save", async () => {
    renderEditor(null);
    const nameInput = screen.getByPlaceholderText("Workout name...");
    fireEvent.change(nameInput, { target: { value: "My Workout" } });

    // Add an exercise first
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Push-ups"));

    fireEvent.click(screen.getByText("Save Workout"));

    await vi.waitFor(() => {
      expect(mockCreateWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Workout",
          mode: "circuit",
          rounds: 1,
        }),
      );
    });
    expect(onSave).toHaveBeenCalled();
  });

  it("calls api.updateWorkout for existing template on save", async () => {
    renderEditor(mockTemplate);
    fireEvent.click(screen.getByText("Save Workout"));

    await vi.waitFor(() => {
      expect(mockUpdateWorkout).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: "Full Body Circuit",
          mode: "circuit",
          rounds: 3,
        }),
      );
    });
    expect(onSave).toHaveBeenCalled();
  });
});
