import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatsGrid from "../components/history/StatsGrid";
import type { WorkoutSession } from "../api";

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 1,
    template_id: 10,
    template_name: "Morning Routine",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    total_duration_seconds: 1800,
    total_kcal_estimated: 250,
    notes: "",
    boxing_entry_id: null,
    run_entry_id: null,
    cycling_entry_id: null,
    exercises: [],
    ...overrides,
  };
}

describe("StatsGrid", () => {
  it("shows zeroed stats for no sessions", () => {
    render(<StatsGrid sessions={[]} />);
    // "0" appears for both the session count and the kcal total.
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0m")).toBeInTheDocument();
    expect(screen.getByText("0s")).toBeInTheDocument();
    expect(screen.getByText("Workouts")).toBeInTheDocument();
    expect(screen.getByText("Total Time")).toBeInTheDocument();
    expect(screen.getByText("Kcal")).toBeInTheDocument();
    expect(screen.getByText("Avg")).toBeInTheDocument();
  });

  it("computes session count, total time, kcal and average duration", () => {
    // 30 min (1800s, 250 kcal) + 25 min (1500s, 350 kcal)
    render(
      <StatsGrid
        sessions={[
          makeSession(),
          makeSession({ id: 2, total_duration_seconds: 1500, total_kcal_estimated: 350 }),
        ]}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument(); // totalSessions
    expect(screen.getByText("55m")).toBeInTheDocument(); // formatHours(55)
    expect(screen.getByText("600")).toBeInTheDocument(); // kcal
    expect(screen.getByText("28m 0s")).toBeInTheDocument(); // avg = round(55/2)*60 = 1680s
  });
});
