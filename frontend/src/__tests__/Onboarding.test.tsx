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
});
