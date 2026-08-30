import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppleHealthCharts from "../components/health/AppleHealthCharts";
import type { HealthSeries } from "../api";

// Module-level mock functions for api
const mockGetHealthWorkouts = vi.fn().mockResolvedValue({ workouts: [] });
const mockGetDailyActivity = vi.fn().mockResolvedValue({ days: [] });
const mockGetWellnessEntries = vi.fn().mockResolvedValue([]);

vi.mock("../api", () => ({
  api: {
    getHealthWorkouts: (...args: unknown[]) => mockGetHealthWorkouts(...args),
    getDailyActivity: (...args: unknown[]) => mockGetDailyActivity(...args),
    getWellnessEntries: (...args: unknown[]) => mockGetWellnessEntries(...args),
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
    label: "Sleep",
    unit: "h",
    points,
  });

  const makeHrSeries = (points: HealthSeries["points"]): HealthSeries => ({
    metric: "heart_rate",
    label: "Heart Rate",
    unit: "bpm",
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
            { date: "2026-07-01", value: 7.5, min: null, max: null, stages: { deep: 2, core: 4, rem: 1.5, awake: 0.2 } },
            { date: "2026-07-03", value: 6.8, min: null, max: null, stages: { deep: 1.5, core: 4, rem: 1.3, awake: 0.1 } },
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
            { date: "2026-07-01", value: 65, min: 55, max: 75, stages: null },
            { date: "2026-07-03", value: 68, min: 58, max: 78, stages: null },
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
            { date: "2026-07-01", value: 7.5, min: null, max: null, stages: null },
            { date: "2026-07-03", value: 6.8, min: null, max: null, stages: null },
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
            { date: "2026-07-01", value: 7.5, min: null, max: null, stages: null },
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
            { date: "2026-07-01", value: 65, min: null, max: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Heart Rate Range");
    expect(screen.getByText(/More data needed for trend/)).toBeInTheDocument();
  });

  it("renders workout intensity scatter with normalized names", async () => {
    mockGetHealthWorkouts.mockResolvedValue({
      workouts: [
        { date: "2026-07-01", name: "Hardlopen", duration_min: 30, distance_km: 5, energy_kcal: 300, avg_hr: 155, max_hr: 180 },
        { date: "2026-07-02", name: "wandelen", duration_min: 60, distance_km: 4, energy_kcal: 200, avg_hr: 95, max_hr: 110 },
        { date: "2026-07-03", name: "Hardlopen", duration_min: 45, distance_km: 8, energy_kcal: 500, avg_hr: 165, max_hr: 190 },
      ],
    });
    mockGetDailyActivity.mockResolvedValue({ days: [] });
    mockGetWellnessEntries.mockResolvedValue([]);

    render(<AppleHealthCharts series={[]} weightEntries={[]} />);

    await screen.findByText("Workout Intensity");
    expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
    // Dutch "wandelen" normalizes to "Buiten Wandelen"; Hardlopen unchanged.
    expect(screen.getByText("Buiten Wandelen")).toBeInTheDocument();
    expect(screen.getByText("Hardlopen")).toBeInTheDocument();
  });

  it("shows Other legend when more than 6 workout names", async () => {
    const names = ["Run", "Walk", "Cycle", "Swim", "Box", "Yoga", "Pilates", "HIIT"];
    mockGetHealthWorkouts.mockResolvedValue({
      workouts: names.map((name, i) => ({
        date: `2026-07-0${(i % 7) + 1}`,
        name,
        duration_min: 30 + i * 5,
        distance_km: 5,
        energy_kcal: 300,
        avg_hr: 150 + i,
        max_hr: 180,
      })),
    });
    mockGetDailyActivity.mockResolvedValue({ days: [] });
    mockGetWellnessEntries.mockResolvedValue([]);

    render(<AppleHealthCharts series={[]} weightEntries={[]} />);

    await screen.findByText("Workout Intensity");
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders recovery vs training load dual-axis chart", async () => {
    mockGetHealthWorkouts.mockResolvedValue({ workouts: [] });
    mockGetDailyActivity.mockResolvedValue({
      days: [
        { date: "2026-07-01", minutes: 45, kcal: 300 },
        { date: "2026-07-02", minutes: 0, kcal: 0 },
        { date: "2026-07-03", minutes: 30, kcal: 200 },
      ],
    });
    mockGetWellnessEntries.mockResolvedValue([]);

    render(
      <AppleHealthCharts
        series={[
          {
            metric: "resting_heart_rate",
            label: "Resting HR",
            unit: "bpm",
            points: [
              { date: "2026-07-01", value: 58, min: null, max: null, stages: null },
              { date: "2026-07-03", value: 61, min: null, max: null, stages: null },
            ],
          },
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Recovery vs Training Load");
    expect(screen.getByTestId("dual-axis-chart")).toBeInTheDocument();
  });

  it("renders sleep vs mood dual-axis chart", async () => {
    mockGetHealthWorkouts.mockResolvedValue({ workouts: [] });
    mockGetDailyActivity.mockResolvedValue({ days: [] });
    mockGetWellnessEntries.mockResolvedValue([
      { id: 1, date: "2026-07-01", mood: 4, energy: 4, stress: 2, sleep_hours: 7, notes: "", created_at: "" },
      { id: 2, date: "2026-07-02", mood: 3, energy: 3, stress: 3, sleep_hours: 6, notes: "", created_at: "" },
      { id: 3, date: "2026-07-03", mood: 5, energy: 5, stress: 1, sleep_hours: 8, notes: "", created_at: "" },
    ]);

    render(
      <AppleHealthCharts
        series={[
          makeSleepSeries([
            { date: "2026-07-01", value: 7.5, min: null, max: null, stages: null },
            { date: "2026-07-02", value: 6.8, min: null, max: null, stages: null },
          ]),
        ]}
        weightEntries={[]}
      />,
    );

    await screen.findByText("Sleep vs Mood");
    expect(screen.getByTestId("dual-axis-chart")).toBeInTheDocument();
  });

  it("renders active energy vs weight dual-axis chart", async () => {
    mockGetHealthWorkouts.mockResolvedValue({ workouts: [] });
    mockGetDailyActivity.mockResolvedValue({ days: [] });
    mockGetWellnessEntries.mockResolvedValue([]);

    render(
      <AppleHealthCharts
        series={[
          {
            metric: "active_energy",
            label: "Energy",
            unit: "kcal",
            points: [
              { date: "2026-07-01", value: 500, min: null, max: null, stages: null },
              { date: "2026-07-02", value: 650, min: null, max: null, stages: null },
            ],
          },
        ]}
        weightEntries={[
          { id: 1, weight_kg: 70, date: "2026-07-01", notes: "", created_at: "" },
          { id: 2, weight_kg: 69.5, date: "2026-07-02", notes: "", created_at: "" },
        ]}
      />,
    );

    await screen.findByText("Active Energy vs Weight");
    expect(screen.getByTestId("dual-axis-chart")).toBeInTheDocument();
  });
});