import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExerciseImage from "../components/ExerciseImage";

describe("ExerciseImage", () => {
  it("shows initial letter fallback when no src", () => {
    render(<ExerciseImage src={null} alt="Pushups" />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("shows shimmer skeleton when src is provided (loading state)", () => {
    const { container } = render(<ExerciseImage src="https://example.com/img.jpg" alt="Squats" />);
    // The shimmer skeleton should be present during loading
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    // The img should exist but be hidden
    const img = screen.getByAltText("Squats");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
    // Loading state: img should be opacity-0
    expect(img.className).toContain("opacity-0");
  });

  it("transitions to loaded state when image loads", () => {
    render(<ExerciseImage src="https://example.com/img.jpg" alt="Squats" />);
    const img = screen.getByAltText("Squats");
    fireEvent.load(img);
    // After load, img should be visible
    expect(img.className).toContain("opacity-100");
  });

  it("shows fallback on image error", () => {
    render(<ExerciseImage src="https://example.com/broken.jpg" alt="Deadlift" />);
    const img = screen.getByAltText("Deadlift");
    fireEvent.error(img);
    // Should show the initial letter fallback
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("applies category color for cardio", () => {
    render(
      <ExerciseImage
        src="https://example.com/img.jpg"
        alt="Running"
        category="cardio"
      />,
    );
    const img = screen.getByAltText("Running");
    fireEvent.error(img);
    // The fallback div should have the cardio color class
    const fallback = screen.getByText("R");
    expect(fallback.className).toContain("text-green-500");
  });

  it("applies category color for strength", () => {
    render(
      <ExerciseImage
        src="https://example.com/img.jpg"
        alt="Pushups"
        category="strength"
      />,
    );
    const img = screen.getByAltText("Pushups");
    fireEvent.error(img);
    const fallback = screen.getByText("P");
    expect(fallback.className).toContain("text-blue-500");
  });

  it("applies default color for unknown category", () => {
    render(
      <ExerciseImage
        src="https://example.com/img.jpg"
        alt="Unknown"
        category="unknown_cat"
      />,
    );
    const img = screen.getByAltText("Unknown");
    fireEvent.error(img);
    const fallback = screen.getByText("U");
    expect(fallback.className).toContain("text-fg/40");
  });

  it("uses custom className", () => {
    const { container } = render(
      <ExerciseImage
        src={null}
        alt="Test"
        className="w-12 h-12 rounded-full"
      />,
    );
    // The outer container div should have the classes
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("rounded-full");
    expect(outerDiv.className).toContain("w-12");
  });
});