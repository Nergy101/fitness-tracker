import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionList from "../components/history/SessionList";
import type { WorkoutSession } from "../api";

vi.mock("../components/history/SessionCard", () => ({
  default: ({ session, onDelete }: { session: WorkoutSession; onDelete: (s: WorkoutSession) => void }) => (
    <div data-testid="session-card">
      <span>{session.template_name}</span>
      <button onClick={() => onDelete(session)}>Delete</button>
    </div>
  ),
}));

function makeSession(id: number): WorkoutSession {
  return {
    id,
    template_id: 10,
    template_name: `Session ${id}`,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    total_duration_seconds: 1800,
    total_kcal_estimated: 250,
    notes: "",
    boxing_entry_id: null,
    run_entry_id: null,
    cycling_entry_id: null,
    exercises: [],
  };
}

describe("SessionList", () => {
  it("shows the empty label when there are no sessions", () => {
    render(
      <SessionList
        sessions={[]}
        onSelect={vi.fn()}
        onEditDate={vi.fn()}
        onDelete={vi.fn()}
        emptyLabel="No workouts yet"
      />,
    );
    expect(screen.getByText("No workouts yet")).toBeInTheDocument();
  });

  it("renders the first page of sessions and reveals more via Load more", () => {
    const sessions = Array.from({ length: 55 }, (_, i) => makeSession(i + 1));
    render(
      <SessionList
        sessions={sessions}
        onSelect={vi.fn()}
        onEditDate={vi.fn()}
        onDelete={vi.fn()}
        emptyLabel=""
      />,
    );
    expect(screen.getAllByTestId("session-card")).toHaveLength(50);
    expect(screen.getByText("Load more")).toBeInTheDocument();
    expect(screen.getByText("(5 remaining)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more sessions" }));
    expect(screen.getAllByTestId("session-card")).toHaveLength(55);
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("passes through the delete callback", () => {
    const onDelete = vi.fn();
    render(
      <SessionList
        sessions={[makeSession(1)]}
        onSelect={vi.fn()}
        onEditDate={vi.fn()}
        onDelete={onDelete}
        emptyLabel=""
      />,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalled();
  });
});
