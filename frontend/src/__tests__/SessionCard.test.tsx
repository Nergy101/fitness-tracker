import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SessionCard from "../components/history/SessionCard";
import type { WorkoutSession } from "../api";

const mockUpdateSession = vi.fn();

vi.mock("../api", () => ({
  api: {
    updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  },
}));

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 1,
    template_id: 10,
    template_name: "Run: 5.0km",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    total_duration_seconds: 1500,
    total_kcal_estimated: 350,
    notes: "",
    boxing_entry_id: null,
    run_entry_id: null,
    cycling_entry_id: null,
    exercises: [
      { id: 1, session_id: 1, exercise_id: 5, exercise_name: "Push-ups", duration_seconds: 120, kcal_burned: 25, order_index: 0, completed: true, image_url: null, logs: [] },
      { id: 2, session_id: 1, exercise_id: 6, exercise_name: "Squats", duration_seconds: 120, kcal_burned: 25, order_index: 1, completed: true, image_url: null, logs: [] },
    ],
    ...overrides,
  };
}

describe("SessionCard", () => {
  beforeEach(() => {
    mockUpdateSession.mockReset();
  });

  it("renders the session name, kcal, duration and exercise count", () => {
    render(
      <SessionCard
        session={makeSession()}
        onSelect={vi.fn()}
        onEditDate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Run: 5.0km")).toBeInTheDocument();
    expect(screen.getByText("~350 kcal")).toBeInTheDocument();
    expect(screen.getByText("25m 0s")).toBeInTheDocument();
    expect(screen.getByText("2 exercises")).toBeInTheDocument();
  });

  it("calls onSelect when the card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SessionCard
        session={makeSession()}
        onSelect={onSelect}
        onEditDate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Run: 5.0km"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("calls onDelete when the delete button is clicked without selecting", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <SessionCard
        session={makeSession()}
        onSelect={onSelect}
        onEditDate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    expect(onDelete).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("edits the date inline and saves via api.updateSession", async () => {
    const onEditDate = vi.fn();
    mockUpdateSession.mockResolvedValue({ id: 1 });
    render(
      <SessionCard
        session={makeSession()}
        onSelect={vi.fn()}
        onEditDate={onEditDate}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle("Edit date/time"));
    const input = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "2026-07-06T14:00" } });
    fireEvent.blur(input);
    expect(mockUpdateSession).toHaveBeenCalledWith(1, { started_at: "2026-07-06T14:00:00" });
    await waitFor(() => expect(onEditDate).toHaveBeenCalledWith({ id: 1 }));
  });
});
