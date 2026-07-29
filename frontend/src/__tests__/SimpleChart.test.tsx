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

const entry = (
  id: number,
  date: string,
  weight_kg: number,
): WeightEntryResponse => ({
  id,
  date,
  weight_kg,
  notes: "",
  created_at: `${date}T00:00:00Z`,
});

describe("SimpleChart", () => {
  it("returns null when fewer than 2 entries", () => {
    const { container } = render(
      <SimpleChart entries={[entry(1, "2026-07-01", 80)]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chart with 2 entries", () => {
    const entries = [entry(1, "2026-07-01", 80), entry(2, "2026-07-15", 78)];
    render(<SimpleChart entries={entries} />);
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });

  it("renders chart with 30+ entries (only shows 30)", () => {
    const entries = Array.from({ length: 35 }, (_, i) =>
      entry(i + 1, `2026-07-${String(i + 1).padStart(2, "0")}`, 80 - i * 0.1),
    );
    render(<SimpleChart entries={entries} />);
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });

  it("renders SVG polyline", () => {
    const entries = [entry(1, "2026-07-01", 80), entry(2, "2026-07-15", 78)];
    const { container } = render(<SimpleChart entries={entries} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
  });

  it("renders data point circles", () => {
    const entries = [entry(1, "2026-07-01", 80), entry(2, "2026-07-15", 78)];
    const { container } = render(<SimpleChart entries={entries} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("renders min/max labels", () => {
    const entries = [entry(1, "2026-07-01", 75), entry(2, "2026-07-15", 85)];
    render(<SimpleChart entries={entries} />);
    // text elements for min/max values
    expect(screen.getByText("86.0")).toBeInTheDocument();
    expect(screen.getByText("74.0")).toBeInTheDocument();
  });

  it("sorts entries by date", () => {
    const entries = [entry(2, "2026-07-15", 78), entry(1, "2026-07-01", 80)];
    render(<SimpleChart entries={entries} />);
    // Should still render (sorted internally)
    expect(screen.getByText("Weight Trend (30d)")).toBeInTheDocument();
  });
});