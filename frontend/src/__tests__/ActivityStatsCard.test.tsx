import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityStatsCard } from "../components/health/ActivityStatsCard";
import type { ActivityStats } from "../components/health/utils";

const baseStats: ActivityStats = {
  sessions: 5,
  total_hours: 2.5,
  avg_duration_seconds: 1800,
  total_kcal_estimated: 500,
  avg_kcal_per_min: 2.8,
  monthly_breakdown: [],
};

describe("ActivityStatsCard", () => {
  it("renders the activity label for the given kind", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.getByText("Runs")).toBeInTheDocument();
  });

  it("renders the Sessions stat card", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders the Total hours stat card", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.getByText("Total hours")).toBeInTheDocument();
    expect(screen.getByText("2.5h")).toBeInTheDocument();
  });

  it("renders the Avg session stat card with formatted minutes", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.getByText("Avg session")).toBeInTheDocument();
    // 1800 seconds / 60 = 30 minutes
    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("renders '—' for avg session when avg_duration_seconds is null", () => {
    render(<ActivityStatsCard kind="run" stats={{ ...baseStats, avg_duration_seconds: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders '—' for avg session when avg_duration_seconds is 0", () => {
    render(<ActivityStatsCard kind="run" stats={{ ...baseStats, avg_duration_seconds: 0 }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the Total kcal stat card", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.getByText("Total kcal")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders monthly breakdown rows when monthly_breakdown is non-empty", () => {
    const stats: ActivityStats = {
      ...baseStats,
      monthly_breakdown: [
        { month: "2026-06", sessions: 3, total_minutes: 90 },
        { month: "2026-05", sessions: 2, total_minutes: 60 },
      ],
    };
    render(<ActivityStatsCard kind="run" stats={stats} />);
    expect(screen.getByText("2026-06")).toBeInTheDocument();
    expect(screen.getByText("3 sessions · 90 min")).toBeInTheDocument();
    expect(screen.getByText("2026-05")).toBeInTheDocument();
    expect(screen.getByText("2 sessions · 60 min")).toBeInTheDocument();
  });

  it("omits the monthly section when monthly_breakdown is empty", () => {
    render(<ActivityStatsCard kind="run" stats={baseStats} />);
    expect(screen.queryByText("Monthly")).not.toBeInTheDocument();
  });

  it("renders the workout label for kind=workout", () => {
    render(<ActivityStatsCard kind="workout" stats={baseStats} />);
    expect(screen.getByText("Workouts")).toBeInTheDocument();
  });
});
