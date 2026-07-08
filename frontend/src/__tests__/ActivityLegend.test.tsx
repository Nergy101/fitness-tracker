import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityLegend from "../components/ActivityLegend";
import { ACTIVITY_LABELS } from "../activity";

describe("ActivityLegend", () => {
  it("renders all provided activity kinds with labels", () => {
    render(<ActivityLegend kinds={["workout", "run", "walk"]} />);
    expect(screen.getByText(ACTIVITY_LABELS.workout)).toBeInTheDocument();
    expect(screen.getByText(ACTIVITY_LABELS.run)).toBeInTheDocument();
    expect(screen.getByText(ACTIVITY_LABELS.walk)).toBeInTheDocument();
  });

  it("renders a subset of kinds", () => {
    render(<ActivityLegend kinds={["workout"]} />);
    expect(screen.getByText(ACTIVITY_LABELS.workout)).toBeInTheDocument();
    expect(screen.queryByText(ACTIVITY_LABELS.run)).not.toBeInTheDocument();
  });

  it("renders color dot spans for each kind", () => {
    render(<ActivityLegend kinds={["run", "walk"]} />);
    // Each kind gets a color-dot span
    const dots = document.querySelectorAll(".rounded-full");
    expect(dots).toHaveLength(2);
  });

  it("renders nothing visible when kinds array is empty", () => {
    const { container } = render(<ActivityLegend kinds={[]} />);
    // The container still has a div wrapper, but no text children
    expect(screen.queryByText(ACTIVITY_LABELS.workout)).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-full")).toBeNull();
  });
});
