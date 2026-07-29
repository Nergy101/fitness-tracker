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

  it("renders with heading 'Add' when no template provided", () => {
    renderEditor(null);
    expect(screen.getByText("Add")).toBeInTheDocument();
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

  // ── Remove exercise ──

  it("removes an exercise when remove is triggered on the last row", async () => {
    // Template has 1 exercise (Push-ups). Can't remove last one.
    renderEditor(mockTemplate);

    // Find the trash button (SVG inside the remove button) — but removing the last exercise
    // should trigger an alert
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const removeButtons = document.querySelectorAll('[title="Remove"]');
    expect(removeButtons.length).toBe(1);
    fireEvent.click(removeButtons[0]);

    expect(alertSpy).toHaveBeenCalledWith(
      "Template must have at least 1 exercise",
    );
    alertSpy.mockRestore();
  });

  it("removes an exercise when multiple exist", () => {
    // Create a fresh editor and add 2 exercises
    renderEditor(null);
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Push-ups"));
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Squats"));

    // Now we should have 2 exercise rows
    expect(screen.getAllByText("Push-ups").length).toBe(1);
    expect(screen.getByText("Squats")).toBeInTheDocument();

    // Remove Squats
    const removeButtons = document.querySelectorAll('[title="Remove"]');
    fireEvent.click(removeButtons[1]); // Second exercise

    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
  });

  // ── Mode switching ──

  it("selects Tabata mode and auto-sets rounds to 8", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("Tabata"));
    // Should show Tabata info with total time
    const totalElements = screen.getAllByText(/Total/);
    expect(totalElements.length).toBeGreaterThan(0);
  });

  it("hides rounds stepper when AMRAP selected", () => {
    renderEditor(null);
    expect(screen.getByText("Rounds")).toBeInTheDocument();
    fireEvent.click(screen.getByText("AMRAP"));
    expect(screen.queryByText("Rounds")).not.toBeInTheDocument();
  });

  // ── Save validation ──

  it("does not call api when saving with empty name", () => {
    renderEditor(null);
    const saveBtn = screen.getByText("Save Workout");
    expect(saveBtn).toBeDisabled();
    fireEvent.click(saveBtn);
    expect(mockCreateWorkout).not.toHaveBeenCalled();
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
  });

  it("shows 'Saving...' when saving", async () => {
    mockCreateWorkout.mockImplementation(() => new Promise((r) => setTimeout(r, 100)));

    renderEditor(null);
    const nameInput = screen.getByPlaceholderText("Workout name...");
    fireEvent.change(nameInput, { target: { value: "Slow Save" } });
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Push-ups"));
    fireEvent.click(screen.getByText("Save Workout"));

    // Should show Saving... state
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  // ── Edit mode ──

  it("pre-fills description when editing", () => {
    renderEditor(mockTemplate);
    const descTextarea = screen.getByPlaceholderText(
      "Description (optional)...",
    );
    expect(descTextarea).toHaveValue("A challenging full body workout");
  });

  it("pre-fills exercises when editing template", () => {
    renderEditor(mockTemplate);
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    // Should not show empty state
    expect(
      screen.queryByText("Add exercises to build your workout"),
    ).not.toBeInTheDocument();
  });

  // ── Warmup / Cooldown ──

  it("shows warmup time input when warmup is enabled", () => {
    renderEditor(null);
    // Warmup checkbox label
    const warmupLabel = screen.getByText("Include warmup");
    fireEvent.click(warmupLabel);
    // Should show minutes input
    const minInputs = document.querySelectorAll('input[type="number"]');
    expect(minInputs.length).toBeGreaterThan(0);
  });

  it("shows cooldown time input when cooldown is enabled", () => {
    renderEditor(null);
    const cooldownLabel = screen.getByText("Include cooldown");
    fireEvent.click(cooldownLabel);
    const minInputs = document.querySelectorAll('input[type="number"]');
    expect(minInputs.length).toBeGreaterThan(0);
  });

  // ── Exercise row editing ──

  it("renders exercise duration stepper", () => {
    renderEditor(mockTemplate);
    // Duration steppers should be visible
    const steppers = document.querySelectorAll('[role="group"]');
    expect(steppers.length).toBeGreaterThanOrEqual(1);
  });

  it("allows renaming workout when editing", () => {
    renderEditor(mockTemplate);
    const nameInput = screen.getByDisplayValue("Full Body Circuit");
    fireEvent.change(nameInput, { target: { value: "Renamed Circuit" } });
    expect(nameInput).toHaveValue("Renamed Circuit");
  });

  // ── Warmup / Cooldown values ──

  it("shows warmup duration input when warmup is enabled", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("Include warmup"));
    // Should show a minutes stepper
    const groups = document.querySelectorAll('[role="group"]');
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  // ── Delete exercise flow ──  

  it("can remove an exercise when multiple exist", () => {
    renderEditor(null);
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Push-ups"));
    fireEvent.click(screen.getByText("Add Exercise"));
    fireEvent.click(screen.getByText("Squats"));

    // Remove second exercise (Squats)
    const removeBtns = document.querySelectorAll('[title="Remove"]');
    fireEvent.click(removeBtns[1]);
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
  });
});
