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

  it("opens a session detail when a day with sessions is clicked", () => {
    const session=makeSession();
    render(<CalendarView sessions={[session]} />);
    const day=new Date(session.started_at).getDate();
    const dateCell=screen.getAllByRole("button").find((button)=>button.textContent?.trim().startsWith(String(day)) && button.textContent?.includes("30m"));
    expect(dateCell).toBeTruthy();
    fireEvent.click(dateCell!);
    expect(screen.getByText("Morning Routine")).toBeInTheDocument();
  });

  it("renders an empty calendar without session detail", () => {
    render(<CalendarView sessions={[]} />);
    expect(screen.getByText(`${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`)).toBeInTheDocument();
    expect(screen.queryByText("Morning Routine")).not.toBeInTheDocument();
  });
});
