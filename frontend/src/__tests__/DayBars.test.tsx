import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DayBars from "../components/history/DayBars";
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

describe("DayBars", () => {
  it("renders the activity legend with all kinds", () => {
    render(<DayBars sessions={[]} mode="7d" />);
    expect(screen.getByText("Workouts")).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("Walks")).toBeInTheDocument();
    expect(screen.getByText("Boxing")).toBeInTheDocument();
    expect(screen.getByText("Cycling")).toBeInTheDocument();
  });

  it("renders weekday single-letter labels in week mode", () => {
    render(<DayBars sessions={[]} mode="week" />);
    // M, T, W, F each appear once; T and S appear twice across Mon–Sun.
    expect(screen.getAllByText("M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("T").length).toBeGreaterThan(0);
    expect(screen.getAllByText("W").length).toBeGreaterThan(0);
    expect(screen.getAllByText("S").length).toBeGreaterThan(0);
  });

  it("shows the session count for today in 7d mode", () => {
    render(<DayBars sessions={[makeSession(), makeSession({ id: 2 }), makeSession({ id: 3 })]} mode="7d" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("stacks activity types into the daily total", () => {
    render(
      <DayBars
        sessions={[makeSession(), makeSession({ id: 2, template_name: "Run: 5.0km" })]}
        mode="7d"
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
