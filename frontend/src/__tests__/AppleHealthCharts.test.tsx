import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AppleHealthCharts from "../components/health/AppleHealthCharts";
import type { HealthSeries } from "../api";

// Module-level mock functions for api
const mockGetHealthWorkouts = vi.fn().mockResolvedValue({ workouts: [] });
const mockGetDailyActivity = vi.fn().mockResolvedValue({ days: [] });
const mockGetWellnessEntries = vi.fn().mockResolvedValue([]);

vi.mock("../../api", () => ({
  api: {
    getHealthWorkouts: (...args: any[]) => mockGetHealthWorkouts(...args),
    getDailyActivity: (...args: any[]) => mockGetDailyActivity(...args),
    getWellnessEntries: (...args: any[]) => mockGetWellnessEntries(...args),
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  MoonIcon: () => <span data-icon="moon" />,
  PulseIcon: () => <span data-icon="pulse" />,
  PersonSimpleRunIcon: () => <span data-icon="run" />,
  BarbellIcon: () => <span data-icon="barbell" />,
  FireIcon: () => <span data-icon="fire" />,
  SmileyIcon: () => <span data-icon="smiley" />,
  SneakerIcon: () => <span data-icon="sneaker" />,
  HandFistIcon: () => <span data-icon="fist" />,
}));
vi.mock("@phosphor-icons/react/dist/csr/Boot", () => ({
  Boot: () => <span data-icon="boot" />,
}));

vi.mock("../components/health/insightCharts", () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  DailyStackedBarChart: () => <div data-testid="stacked-bar-chart" />,
  ScatterChart: () => <div data-testid="scatter-chart" />,
  BandChart: () => <div data-testid="band-chart" />,
  DualAxisChart: () => <div data-testid="dual-axis-chart" />,
  ACCENT: "#4cb782",
}));

vi.mock("../components/health/utils", () => ({
  shortDate: (d: string) => d.slice(0, 10),
}));

describe("AppleHealthCharts", () => {
  const makeSleepSeries = (points: HealthSeries["points"]): HealthSeries => ({
    metric: "sleep_analysis",
    points,
  });

  const makeHrSeries = (points: HealthSeries["points"]): HealthSeries => ({
    metric: "heart_rate",
    points,
  });

  it("renders nothing when no series match", () => {
    const { container } = render(
      <AppleHealthCharts series={[]} weightEntries={[]} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders sleep chart with stages", async () => {
    render(
      <AppleHealthCharts
        series={[
          makeSleepSeries([
            { date: "2026-07-01", value: 7.5, min: null, max: null, qty: null, stages: { deep: 2, core: 4, rem: 1.5 } },
            { date: "2026-07-03", value: 6.8, min: null, max: null, qty: null, stages: { deep: 1.5, core: 4, rem: 1.3 } },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Sleep");
    expect(screen.getByTestId("stacked-bar-chart")).toBeInTheDocument();
  });

  it("renders heart rate band chart", async () => {
    render(
      <AppleHealthCharts
        series={[
          makeHrSeries([
            { date: "2026-07-01", value: 65, min: 55, max: 75, qty: null, stages: null },
            { date: "2026-07-03", value: 68, min: 58, max: 78, qty: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Heart Rate Range");
    expect(screen.getByTestId("band-chart")).toBeInTheDocument();
  });

  it("renders bar chart for sleep without stages", async () => {
    render(
      <AppleHealthCharts
        series={[
          makeSleepSeries([
            { date: "2026-07-01", value: 7.5, min: null, max: null, qty: null, stages: null },
            { date: "2026-07-03", value: 6.8, min: null, max: null, qty: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Sleep");
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows sync hint when only 1 data point", async () => {
    render(
      <AppleHealthCharts
        series={[
          makeSleepSeries([
            { date: "2026-07-01", value: 7.5, min: null, max: null, qty: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Sleep");
    expect(screen.getByText(/More data needed for trend/)).toBeInTheDocument();
  });

  it("shows sync hint for single HR point", async () => {
    render(
      <AppleHealthCharts
        series={[
          makeHrSeries([
            { date: "2026-07-01", value: 65, min: null, max: null, qty: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Heart Rate Range");
    expect(screen.getByText(/More data needed for trend/)).toBeInTheDocument();
  });
});