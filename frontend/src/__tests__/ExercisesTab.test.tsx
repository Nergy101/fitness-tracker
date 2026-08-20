import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExercisesTab from "../components/ExercisesTab";
import type { Exercise } from "../api";

// Mock the API module — resolved relative to this test file: ../api -> src/api.ts
vi.mock("../api", () => ({
  api: {
    getExercises: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
    getExerciseLogs: vi.fn(),
  },
  OfflineError: class OfflineError extends Error {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApi = (await import("../api")).api as any;

// ExerciseImage renders an <img> when src is present, else a letter fallback.
// It doesn't hit the network in jsdom, so no additional mock needed.
const exercises: Exercise[] = [
  {
    id: 1,
    name: "Dumbbell Curls",
    description: "Biceps",
    category: "strength",
    default_kcal_per_min: 5,
    default_duration_seconds: 30,
    image_url: null,
    equipment: "dumbbell",
    muscle_group: "biceps",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Push-ups",
    description: "Chest",
    category: "strength",
    default_kcal_per_min: 7,
    default_duration_seconds: 30,
    image_url: null,
    equipment: "bodyweight",
    muscle_group: "chest",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Jumping Jacks",
    description: "Cardio",
    category: "cardio",
    default_kcal_per_min: 8,
    default_duration_seconds: 30,
    image_url: null,
    equipment: "bodyweight",
    muscle_group: "full-body",
    created_at: "2026-01-01T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getExercises.mockResolvedValue(exercises);
  mockApi.getExerciseLogs.mockResolvedValue([]);
});

describe("ExercisesTab", () => {
  it("renders all exercises with equipment labels", async () => {
    render(<ExercisesTab />);
    expect(await screen.findByText("Dumbbell Curls")).toBeInTheDocument();
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    expect(screen.getByText("Jumping Jacks")).toBeInTheDocument();
    // Equipment badge on cards
    expect(screen.getAllByText("Dumbbell").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bodyweight").length).toBeGreaterThan(0);
  });

  it("filters by equipment", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getByLabelText("Filter by equipment dumbbell"));
    expect(screen.getByText("Dumbbell Curls")).toBeInTheDocument();
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument();
  });

  it("filters by muscle group", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getByLabelText("Filter by muscle group chest"));
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    expect(screen.queryByText("Dumbbell Curls")).not.toBeInTheDocument();
  });

  it("combines category + equipment + muscle filters", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getAllByText("strength")[0]);
    fireEvent.click(screen.getByLabelText("Filter by equipment dumbbell"));
    fireEvent.click(screen.getByLabelText("Filter by muscle group biceps"));
    expect(screen.getByText("Dumbbell Curls")).toBeInTheDocument();
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument();
  });

  it("shows empty state with clear-filters when nothing matches", async () => {
    mockApi.getExercises.mockResolvedValue(exercises);
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    // A muscle group present in the data but no exercise is that muscle.
    fireEvent.click(screen.getByLabelText("Filter by muscle group biceps"));
    fireEvent.click(screen.getByLabelText("Filter by equipment bodyweight"));
    // Bodyweight exercises are not biceps → nothing matches.
    expect(await screen.findByText("No exercises found")).toBeInTheDocument();
    expect(screen.getByText("clear filters")).toBeInTheDocument();
  });

  it("opens detail view on card click and shows equipment/muscles + history", async () => {
    mockApi.getExerciseLogs.mockResolvedValue([
      {
        id: 10,
        session_exercise_id: 5,
        weight_kg: 80,
        reps: 10,
        set_number: 1,
        rpe: 8,
        notes: "",
        created_at: "2026-06-01T00:00:00Z",
      },
    ]);
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getByText("Dumbbell Curls"));
    // Detail header
    expect(await screen.findByText("History")).toBeInTheDocument();
    // Equipment + muscle chips in detail
    expect(screen.getAllByText("Dumbbell").length).toBeGreaterThan(0);
    expect(screen.getAllByText("biceps").length).toBeGreaterThan(0);
    // Best set (Epley 80*(1+10/30)=106.67 -> 107)
    expect(screen.getByText(/est. 1RM 107 kg/)).toBeInTheDocument();
    // Recent set row
    expect(screen.getByText("80 kg × 10 @RPE 8")).toBeInTheDocument();
  });

  it("shows empty history state when no logs exist", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Push-ups");
    fireEvent.click(screen.getByText("Push-ups"));
    expect(
      await screen.findByText("No logged sets yet for this exercise."),
    ).toBeInTheDocument();
  });

  it("opens edit form from detail view", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getByText("Dumbbell Curls"));
    await screen.findByText("History");
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Edit Exercise")).toBeInTheDocument();
    // Form pre-filled with equipment/muscle selects
    expect((screen.getByDisplayValue("Dumbbell") as HTMLSelectElement).value).toBe(
      "dumbbell",
    );
  });

  it("opens create form with + Add", async () => {
    render(<ExercisesTab />);
    await screen.findByText("Dumbbell Curls");
    fireEvent.click(screen.getByText("+ Add"));
    expect(screen.getByText("New Exercise")).toBeInTheDocument();
  });
});
