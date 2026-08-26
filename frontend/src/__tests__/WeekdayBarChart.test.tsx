import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WeekdayBarChart from "../components/history/WeekdayBarChart";
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

describe("WeekdayBarChart", () => {
  it("renders all weekday labels Mon–Sun", () => {
    render(<WeekdayBarChart sessions={[]} />);
    for (const label of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("buckets sessions by the weekday of their start date", () => {
    // Two sessions today (same weekday bucket) -> that bucket shows total 2.
    render(
      <WeekdayBarChart
        sessions={[makeSession(), makeSession({ id: 2 }), makeSession({ id: 3, template_name: "Run: 5.0km" })]}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the activity legend", () => {
    render(<WeekdayBarChart sessions={[]} />);
    expect(screen.getByText("Workouts")).toBeInTheDocument();
    expect(screen.getByText("Cycling")).toBeInTheDocument();
  });
});
