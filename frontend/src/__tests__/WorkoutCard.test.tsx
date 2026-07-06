import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WorkoutCard from "../components/WorkoutCard";
import type { WorkoutTemplate } from "../api";

const mockTemplate: WorkoutTemplate = {
  id: 1,
  name: "Full Body",
  description: "A full body circuit workout",
  mode: "circuit",
  time_cap_seconds: null,
  rounds: 3,
  rest_between_rounds: 60,
  is_pinned: false,
  pinned_order: null,
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
      exercise: {
        id: 100,
        name: "Push-ups",
        description: "",
        category: "strength",
        default_kcal_per_min: 8,
        default_duration_seconds: 30,
        image_url: null,
        created_at: "",
      },
    },
    {
      id: 11,
      template_id: 1,
      exercise_id: 101,
      duration_seconds: 45,
      rest_after_seconds: 0,
      order_index: 1,
      superset_group: null,
      exercise: {
        id: 101,
        name: "Squats",
        description: "",
        category: "strength",
        default_kcal_per_min: 10,
        default_duration_seconds: 30,
        image_url: null,
        created_at: "",
      },
    },
  ],
  work_duration_seconds: 225,
  rest_duration_seconds: 120,
  total_duration_seconds: 345,
};

describe("WorkoutCard", () => {
  const onStart = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onLog = vi.fn();
  const onTogglePin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderCard() {
    return render(
      <WorkoutCard
        template={mockTemplate}
        onStart={onStart}
        onEdit={onEdit}
        onDelete={onDelete}
        onLog={onLog}
        onTogglePin={onTogglePin}
      />,
    );
  }

  it("renders the workout name", () => {
    renderCard();
    expect(screen.getByText("Full Body")).toBeInTheDocument();
  });

  it("renders the description", () => {
    renderCard();
    expect(screen.getByText("A full body circuit workout")).toBeInTheDocument();
  });

  it("renders exercise count and rounds", () => {
    renderCard();
    expect(screen.getByText("2 exercises")).toBeInTheDocument();
    expect(screen.getByText("3 rounds")).toBeInTheDocument();
  });

  it("calls onStart when clicking the card body", () => {
    renderCard();
    fireEvent.click(screen.getByText("Full Body"));
    expect(onStart).toHaveBeenCalledWith(mockTemplate);
  });

  it("calls onStart when clicking the Start button", () => {
    renderCard();
    fireEvent.click(screen.getByText("Start"));
    expect(onStart).toHaveBeenCalledWith(mockTemplate);
  });

  it("calls onLog when clicking Log", () => {
    renderCard();
    fireEvent.click(screen.getByText("Log"));
    expect(onLog).toHaveBeenCalledWith(mockTemplate);
  });

  it("calls onEdit when clicking the edit button", () => {
    renderCard();
    const editBtn = screen.getByTitle("Edit");
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockTemplate);
  });

  it("calls onDelete when clicking the delete button", () => {
    renderCard();
    const deleteBtn = screen.getByTitle("Delete");
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockTemplate.id, mockTemplate.name);
  });

  it("calls onTogglePin when clicking the pin button", () => {
    renderCard();
    const pinBtn = screen.getByTitle("Pin workout");
    fireEvent.click(pinBtn);
    expect(onTogglePin).toHaveBeenCalledWith(mockTemplate);
  });

  it("shows filled pin icon and accent border when pinned", () => {
    const pinned: WorkoutTemplate = {
      ...mockTemplate,
      is_pinned: true,
      pinned_order: 1,
    };
    render(
      <WorkoutCard
        template={pinned}
        onStart={onStart}
        onEdit={onEdit}
        onDelete={onDelete}
        onLog={onLog}
        onTogglePin={onTogglePin}
      />,
    );
    const pinBtn = screen.getByTitle("Unpin workout");
    expect(pinBtn).toBeInTheDocument();
  });
});
