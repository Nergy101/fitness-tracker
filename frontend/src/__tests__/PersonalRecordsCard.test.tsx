import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalRecordsCard } from "../components/health/PersonalRecordsCard";
import type { PrsResponse, BoxingPrsResponse } from "../api";

const nullPrs: PrsResponse = {
  longest_run_km: null,
  longest_run_seconds: null,
  fastest_5k_seconds: null,
  fastest_10k_seconds: null,
  best_pace_seconds_per_km: null,
  most_kcal_run: null,
  best_week_run_km: null,
  longest_walk_km: null,
  longest_walk_seconds: null,
  most_kcal_walk: null,
  longest_workout_seconds: null,
  most_kcal_workout: null,
  most_exercises_workout: null,
  longest_streak_days: 0,
  streak_days_30d: 0,
};

describe("PersonalRecordsCard", () => {
  it("renders nothing when all records are null and boxingPrs is null", () => {
    const { container } = render(<PersonalRecordsCard prs={nullPrs} boxingPrs={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders run PR entries when run values are populated", () => {
    const prs: PrsResponse = {
      ...nullPrs,
      longest_run_km: 10.5,
      fastest_5k_seconds: 1500,
    };
    render(<PersonalRecordsCard prs={prs} boxingPrs={null} />);
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("Longest (distance)")).toBeInTheDocument();
    expect(screen.getByText("10.5 km")).toBeInTheDocument();
    expect(screen.getByText("Fastest 5K")).toBeInTheDocument();
  });

  it("renders walk PR entries when walk values are populated", () => {
    const prs: PrsResponse = {
      ...nullPrs,
      longest_walk_km: 5.2,
    };
    render(<PersonalRecordsCard prs={prs} boxingPrs={null} />);
    expect(screen.getByText("Walks")).toBeInTheDocument();
    expect(screen.getByText("Longest (distance)")).toBeInTheDocument();
    expect(screen.getByText("5.2 km")).toBeInTheDocument();
  });

  it("renders workout PR entries when workout values are populated", () => {
    const prs: PrsResponse = {
      ...nullPrs,
      most_exercises_workout: 8,
      most_kcal_workout: 350,
    };
    render(<PersonalRecordsCard prs={prs} boxingPrs={null} />);
    expect(screen.getByText("Workouts")).toBeInTheDocument();
    expect(screen.getByText("Most exercises")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders boxing section when boxingPrs is populated with non-null values", () => {
    const boxingPrs: BoxingPrsResponse = {
      longest_session_seconds: 3600,
      most_kcal_session: 400,
      most_rounds_session: 12,
      total_hours_all_time: 5,
    };
    // Need at least one non-null value in prs or boxing for hasAny to be true
    render(<PersonalRecordsCard prs={nullPrs} boxingPrs={boxingPrs} />);
    expect(screen.getByText("Boxing")).toBeInTheDocument();
    expect(screen.getByText("Longest session")).toBeInTheDocument();
    expect(screen.getByText("Most kcal")).toBeInTheDocument();
    expect(screen.getByText("Most rounds")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5 hr")).toBeInTheDocument();
  });

  it("does not render boxing section when boxingPrs is null", () => {
    const prs: PrsResponse = { ...nullPrs, longest_run_km: 5.0 };
    render(<PersonalRecordsCard prs={prs} boxingPrs={null} />);
    expect(screen.queryByText("Boxing")).not.toBeInTheDocument();
  });

  it("renders Personal Records heading when any value is present", () => {
    const prs: PrsResponse = { ...nullPrs, longest_run_km: 8.0 };
    render(<PersonalRecordsCard prs={prs} boxingPrs={null} />);
    expect(screen.getByText("Personal Records")).toBeInTheDocument();
  });
});
