import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalendarView from "../components/CalendarView";
import type { WorkoutSession } from "../api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

describe("CalendarView", () => {
  it("renders the current month in the header", () => {
    render(<CalendarView sessions={[]} />);
    const now = new Date();
    expect(
      screen.getByText(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`),
    ).toBeInTheDocument();
  });

  it("navigates to the previous month", () => {
    render(<CalendarView sessions={[]} />);
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // prevMonth
    expect(
      screen.getByText(`${MONTHS[prev.getMonth()]} ${prev.getFullYear()}`),
    ).toBeInTheDocument();
  });

  it("navigates to the next month", () => {
    render(<CalendarView sessions={[]} />);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]); // nextMonth (after prev + today)
    expect(
      screen.getByText(`${MONTHS[next.getMonth()]} ${next.getFullYear()}`),
    ).toBeInTheDocument();
  });

  it("shows the day detail panel when today's session day is clicked", () => {
    render(<CalendarView sessions={[makeSession()]} />);
    // Today's cell carries the ring-accent class.
    const todayBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.className.includes("ring-accent"),
    );
    expect(todayBtn).toBeTruthy();
    fireEvent.click(todayBtn!);
    expect(screen.getByText("Morning Routine")).toBeInTheDocument();
  });

  it("does not show detail for a day without sessions", () => {
    render(<CalendarView sessions={[]} />);
    const todayBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.className.includes("ring-accent"),
    );
    fireEvent.click(todayBtn!);
    expect(screen.queryByText("Morning Routine")).not.toBeInTheDocument();
  });
});
