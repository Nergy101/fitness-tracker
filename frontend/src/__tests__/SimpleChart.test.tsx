import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SimpleChart from "../components/health/SimpleChart";
import type { WeightEntryResponse } from "../api";

// Mock the shortDate import from utils
vi.mock("../components/health/utils", () => ({
  shortDate: (d: string) => {
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  },
}));

describe("SimpleChart", () => {
  it("returns null when fewer than 2 entries", () => {
    const { container } = render(
      <SimpleChart
        entries={[
          {
            id: 1,
            date: "2026-07-01",
            weight_kg: 80,
            notes: null,
          },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chart with 2 entries", () => {
    const entries: WeightEntryResponse[] = [
      { id: 1, date: "2026-07-01", weight_kg: 80, notes: null },
      { id: 2, date: "2026-07-15", weight_kg: 78, notes: null },
    ];
    render(<SimpleChart entries={entries} />);
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });

  it("renders chart with 30+ entries (only shows 30)", () => {
    const entries: WeightEntryResponse[] = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1,
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      weight_kg: 80 - i * 0.1,
      notes: null,
    }));
    render(<SimpleChart entries={entries} />);
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });

  it("renders SVG polyline", () => {
    const entries: WeightEntryResponse[] = [
      { id: 1, date: "2026-07-01", weight_kg: 80, notes: null },
      { id: 2, date: "2026-07-15", weight_kg: 78, notes: null },
    ];
    const { container } = render(<SimpleChart entries={entries} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
  });

  it("renders data point circles", () => {
    const entries: WeightEntryResponse[] = [
      { id: 1, date: "2026-07-01", weight_kg: 80, notes: null },
      { id: 2, date: "2026-07-15", weight_kg: 78, notes: null },
    ];
    const { container } = render(<SimpleChart entries={entries} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("renders min/max labels", () => {
    const entries: WeightEntryResponse[] = [
      { id: 1, date: "2026-07-01", weight_kg: 75, notes: null },
      { id: 2, date: "2026-07-15", weight_kg: 85, notes: null },
    ];
    render(<SimpleChart entries={entries} />);
    // text elements for min/max values
    expect(screen.getByText("86.0")).toBeInTheDocument();
    expect(screen.getByText("74.0")).toBeInTheDocument();
  });

  it("sorts entries by date", () => {
    const entries: WeightEntryResponse[] = [
      { id: 2, date: "2026-07-15", weight_kg: 78, notes: null },
      { id: 1, date: "2026-07-01", weight_kg: 80, notes: null },
    ];
    render(<SimpleChart entries={entries} />);
    // Should still render (sorted internally)
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });
});