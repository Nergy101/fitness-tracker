import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HeatmapChart from "../components/history/HeatmapChart";
import type { WorkoutSession } from "../api";
import { dayKey } from "../dateKey";

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

describe("HeatmapChart", () => {
  it("renders weekday single-letter column headers", () => {
    render(<HeatmapChart sessions={[]} />);
    for (const letter of ["M", "T", "W", "F", "S"]) {
      expect(screen.getAllByText(letter).length).toBeGreaterThan(0);
    }
  });

  it("marks a single session today as '1 workout' in its cell title", () => {
    render(<HeatmapChart sessions={[makeSession()]} />);
    expect(
      screen.getByTitle(`${dayKey(new Date())}: 1 workout`),
    ).toBeInTheDocument();
  });

  it("aggregates multiple sessions on the same day", () => {
    render(
      <HeatmapChart
        sessions={[makeSession(), makeSession({ id: 2 }), makeSession({ id: 3, template_name: "Walk: 2km" })]}
      />,
    );
    expect(
      screen.getByTitle(`${dayKey(new Date())}: 3 workouts`),
    ).toBeInTheDocument();
  });
});
