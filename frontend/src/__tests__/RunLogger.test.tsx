import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RunLogger from "../components/RunLogger";

// Mock the api module
vi.mock("../api", () => ({
  api: {
    createRun: vi.fn().mockResolvedValue({ id: 1 }),
    getRuns: vi.fn().mockResolvedValue([]),
    updateRun: vi.fn().mockResolvedValue({ id: 1 }),
    deleteRun: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("RunLogger", () => {
  it("renders the collapsed Log a Run button initially", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    expect(screen.getByText("Log a Run")).toBeInTheDocument();
    expect(
      screen.getByText("Record a run with distance, duration, and pace"),
    ).toBeInTheDocument();
  });

  it("expands the form when clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Log a Run"));
    expect(screen.getByText("Save Run")).toBeInTheDocument();
    // Form fields should be visible
    expect(screen.getByPlaceholderText("e.g. 5.0")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("How did it feel?")).toBeInTheDocument();
  });

  it("collapses the form when Cancel is clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Log a Run"));
    fireEvent.click(screen.getByText("Cancel"));
    // Back to collapsed state
    expect(screen.getByText("Log a Run")).toBeInTheDocument();
  });

  it("shows custom duration input when Custom is selected", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Log a Run"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
  });

  it("shows pace preview when distance and duration are set", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Log a Run"));

    const distanceInput = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(distanceInput, { target: { value: "5" } });

    // Pace should appear (30min / 5km = 6:00/km)
    expect(screen.getByText("6:00 /km")).toBeInTheDocument();
  });
});
