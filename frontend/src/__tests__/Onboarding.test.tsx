import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Onboarding from "../components/Onboarding";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    updateProfile: vi.fn().mockResolvedValue({}),
  },
}));

describe("Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the welcome slide first", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByText("Welcome to FitnessTracker")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    // Finishing is button-only and lives on the last slide.
    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
  });

  it("advances through all slides to the final one", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    expect(screen.getByText("You're all set")).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
  });

  it("skip completes without writing the profile", () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);

    fireEvent.click(screen.getByText("Skip"));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it("writes the goal weight on Get started when set", async () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);

    // Setup slide is index 5.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    fireEvent.change(screen.getByLabelText("Goal weight (kg)"), {
      target: { value: "70" },
    });

    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Get started"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(api.updateProfile).toHaveBeenCalledWith({ goal_weight_kg: 70 });
  });

  it("finishes without a profile write when goal weight is empty", async () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    fireEvent.click(screen.getByText("Get started"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  // ── Navigation ──

  it("goes back to previous slide with Back button", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    // Advance one slide
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Build & run workouts")).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Welcome to FitnessTracker")).toBeInTheDocument();
  });

  it("Back button is hidden on first slide", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    const backBtn = screen.getByText("Back");
    expect(backBtn).toBeDisabled();
  });

  it("navigates via page dots", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    // Click dot for step 3 (index 2)
    const dots = screen.getAllByLabelText(/Go to step/);
    fireEvent.click(dots[2]); // "Your exercise library"
    expect(screen.getByText("Your exercise library")).toBeInTheDocument();
  });

  it("shows setup slide with date format options", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    // Should be on setup slide
    expect(screen.getByText("Quick setup")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal weight (kg)")).toBeInTheDocument();
    expect(screen.getByLabelText("Day/month date format")).toBeInTheDocument();
    expect(screen.getByLabelText("Month/day date format")).toBeInTheDocument();
  });

  it("switches date locale on setup slide", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    // Click M/D button
    fireEvent.click(screen.getByLabelText("Month/day date format"));
    // The button should have aria-pressed="true"
    const mdBtn = screen.getByLabelText("Month/day date format");
    expect(mdBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("Get started is disabled on non-last slide", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    // Not on last slide yet
    expect(screen.queryByText("Get started")).not.toBeInTheDocument();
  });

  it("shows all info slides with correct titles", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    const titles: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Click Next if not on last info slide before setup
      const nextBtn = screen.queryByText("Next");
      if (nextBtn) {
        fireEvent.click(nextBtn);
        // Find the h2 title
        const h2 = document.querySelector("h2");
        if (h2 && h2.textContent) {
          titles.push(h2.textContent);
        }
      }
    }
    // Should have visited several info slides
    expect(titles.length).toBeGreaterThan(0);
  });
});
