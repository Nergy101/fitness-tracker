import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import HealthAndStatsTab from "../components/HealthAndStatsTab";

// Define mock fns at top level so vi.mock hoisting works
const mockGetStatsOverview = vi.fn();
const mockGetSessions = vi.fn();
const mockGetWeightEntries = vi.fn();
const mockGetBmi = vi.fn();
const mockGetPrs = vi.fn();
const mockGetBoxingStats = vi.fn();
const mockGetBoxingPrs = vi.fn();
const mockGetBoxingTrends = vi.fn();
const mockGetGoalProgress = vi.fn();
const mockCreateWeightEntry = vi.fn();
const mockDeleteWeightEntry = vi.fn();
const mockGetMeasurements = vi.fn();
const mockGetMeasurementChanges = vi.fn();
const mockGetWellnessEntries = vi.fn();
const mockGetWellnessTrends = vi.fn();
const mockGetInjuries = vi.fn();
const mockCreateInjury = vi.fn();
const mockUpdateInjury = vi.fn();
const mockDeleteInjury = vi.fn();

vi.mock("../api", () => ({
  api: {
    getStatsOverview: (...args: unknown[]) => mockGetStatsOverview(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getWeightEntries: (...args: unknown[]) => mockGetWeightEntries(...args),
    getBmi: (...args: unknown[]) => mockGetBmi(...args),
    getPrs: (...args: unknown[]) => mockGetPrs(...args),
    getBoxingStats: (...args: unknown[]) => mockGetBoxingStats(...args),
    getBoxingPrs: (...args: unknown[]) => mockGetBoxingPrs(...args),
    getBoxingTrends: (...args: unknown[]) => mockGetBoxingTrends(...args),
    getGoalProgress: (...args: unknown[]) => mockGetGoalProgress(...args),
    createWeightEntry: (...args: unknown[]) => mockCreateWeightEntry(...args),
    deleteWeightEntry: (...args: unknown[]) => mockDeleteWeightEntry(...args),
    getMeasurements: (...args: unknown[]) => mockGetMeasurements(...args),
    getMeasurementChanges: (...args: unknown[]) => mockGetMeasurementChanges(...args),
    getWellnessEntries: (...args: unknown[]) => mockGetWellnessEntries(...args),
    getWellnessTrends: (...args: unknown[]) => mockGetWellnessTrends(...args),
    getInjuries: (...args: unknown[]) => mockGetInjuries(...args),
    createInjury: (...args: unknown[]) => mockCreateInjury(...args),
    updateInjury: (...args: unknown[]) => mockUpdateInjury(...args),
    deleteInjury: (...args: unknown[]) => mockDeleteInjury(...args),
  },
}));

// Inline all phosphor icons to avoid import hoisting issues
vi.mock("@phosphor-icons/react", () => {
  const createIcon = (name: string) => {
    const Icon = (props: Record<string, unknown>) =>
      React.createElement("span", { ...props, "data-testid": `icon-${name}` });
    Icon.displayName = name;
    return Icon;
  };
  return {
    ArrowClockwiseIcon: createIcon("ArrowClockwiseIcon"),
    ArrowCounterClockwiseIcon: createIcon("ArrowCounterClockwiseIcon"),
    ArrowDownIcon: createIcon("ArrowDownIcon"),
    ArrowLeftIcon: createIcon("ArrowLeftIcon"),
    ArrowsLeftRightIcon: createIcon("ArrowsLeftRightIcon"),
    ArrowUpIcon: createIcon("ArrowUpIcon"),
    BandaidsIcon: createIcon("BandaidsIcon"),
    BarbellIcon: createIcon("BarbellIcon"),
    BicycleIcon: createIcon("BicycleIcon"),
    CalendarBlankIcon: createIcon("CalendarBlankIcon"),
    CaretDownIcon: createIcon("CaretDownIcon"),
    CaretLeftIcon: createIcon("CaretLeftIcon"),
    CaretRightIcon: createIcon("CaretRightIcon"),
    CaretUpIcon: createIcon("CaretUpIcon"),
    ChartBarIcon: createIcon("ChartBarIcon"),
    ChartPieSliceIcon: createIcon("ChartPieSliceIcon"),
    CheckCircleIcon: createIcon("CheckCircleIcon"),
    CheckIcon: createIcon("CheckIcon"),
    ClockCounterClockwiseIcon: createIcon("ClockCounterClockwiseIcon"),
    ClockIcon: createIcon("ClockIcon"),
    ConfettiIcon: createIcon("ConfettiIcon"),
    CopyIcon: createIcon("CopyIcon"),
    DownloadSimpleIcon: createIcon("DownloadSimpleIcon"),
    EyeIcon: createIcon("EyeIcon"),
    EyeSlashIcon: createIcon("EyeSlashIcon"),
    FireIcon: createIcon("FireIcon"),
    FlagBannerIcon: createIcon("FlagBannerIcon"),
    FlameIcon: createIcon("FlameIcon"),
    FootprintsIcon: createIcon("FootprintsIcon"),
    GearIcon: createIcon("GearIcon"),
    HandFistIcon: createIcon("HandFistIcon"),
    HeartbeatIcon: createIcon("HeartbeatIcon"),
    HeartIcon: createIcon("HeartIcon"),
    LockKeyIcon: createIcon("LockKeyIcon"),
    MapTrifoldIcon: createIcon("MapTrifoldIcon"),
    MinusIcon: createIcon("MinusIcon"),
    MoonIcon: createIcon("MoonIcon"),
    PauseCircleIcon: createIcon("PauseCircleIcon"),
    PencilSimpleIcon: createIcon("PencilSimpleIcon"),
    PersonSimpleRunIcon: createIcon("PersonSimpleRunIcon"),
    PlantIcon: createIcon("PlantIcon"),
    PlayCircleIcon: createIcon("PlayCircleIcon"),
    PlusIcon: createIcon("PlusIcon"),
    PlusCircleIcon: createIcon("PlusCircleIcon"),
    PulseIcon: createIcon("PulseIcon"),
    PushPinIcon: createIcon("PushPinIcon"),
    RocketLaunchIcon: createIcon("RocketLaunchIcon"),
    RulerIcon: createIcon("RulerIcon"),
    ScalesIcon: createIcon("ScalesIcon"),
    SkipForwardIcon: createIcon("SkipForwardIcon"),
    SmileyIcon: createIcon("SmileyIcon"),
    SmileyMehIcon: createIcon("SmileyMehIcon"),
    SmileySadIcon: createIcon("SmileySadIcon"),
    SmileyStickerIcon: createIcon("SmileyStickerIcon"),
    SmileyWinkIcon: createIcon("SmileyWinkIcon"),
    SneakerIcon: createIcon("SneakerIcon"),
    SpeakerHighIcon: createIcon("SpeakerHighIcon"),
    SpeakerSlashIcon: createIcon("SpeakerSlashIcon"),
    SunHorizonIcon: createIcon("SunHorizonIcon"),
    SunIcon: createIcon("SunIcon"),
    TimerIcon: createIcon("TimerIcon"),
    TrashIcon: createIcon("TrashIcon"),
    TrendDownIcon: createIcon("TrendDownIcon"),
    TrendUpIcon: createIcon("TrendUpIcon"),
    TrophyIcon: createIcon("TrophyIcon"),
    UploadSimpleIcon: createIcon("UploadSimpleIcon"),
    WarningIcon: createIcon("WarningIcon"),
    WifiSlashIcon: createIcon("WifiSlashIcon"),
    XIcon: createIcon("XIcon"),
  };
});

function makeStats() {
  return {
    activity_weekly: [
      {
        week_start: "2026-07-20",
        workout_minutes: 120, run_minutes: 60, walk_minutes: 30, boxing_minutes: 0,
        run_km: 10, walk_km: 3,
        workout_kcal: 500, run_kcal: 400, walk_kcal: 100, boxing_kcal: 0,
      },
      {
        week_start: "2026-07-13",
        workout_minutes: 90, run_minutes: 45, walk_minutes: 20, boxing_minutes: 0,
        run_km: 8, walk_km: 2,
        workout_kcal: 400, run_kcal: 300, walk_kcal: 80, boxing_kcal: 0,
      },
    ],
    total_kcal_burned: 1800,
    consistency_score_pct: 75,
    total_sessions_all: 5,
    total_runs: 3,
    total_walks: 2,
    total_boxing: 0,
    current_month_minutes: 300,
    previous_month_minutes: 250,
    current_month_vs_previous_pct: 20,
    avg_weight_change_kg: -0.5,
  };
}

function makeSessions() {
  return [
    {
      id: 1, template_id: 1, template_name: "Morning Routine",
      started_at: "2026-07-25T08:00:00Z", finished_at: "2026-07-25T08:30:00Z",
      total_duration_seconds: 1800, total_kcal_estimated: 200, notes: "",
      boxing_entry_id: null, run_entry_id: null, exercises: [],
    },
    {
      id: 2, template_id: null, template_name: "Run: 5km",
      started_at: "2026-07-24T07:00:00Z", finished_at: "2026-07-24T07:25:00Z",
      total_duration_seconds: 1500, total_kcal_estimated: 300, notes: "",
      boxing_entry_id: null, run_entry_id: 1, exercises: [],
    },
  ];
}

function makeWeights() {
  return [
    { id: 1, weight_kg: 80.5, date: "2026-07-25", notes: "", created_at: "2026-07-25T08:00:00Z" },
    { id: 2, weight_kg: 81.0, date: "2026-07-18", notes: "", created_at: "2026-07-18T08:00:00Z" },
  ];
}

function makeBmi() {
  return { bmi: 24.5, category: "Normal", color: "green", message: "", height_cm: 181, weight_kg: 80.5, age: 30 };
}

function makePrs() {
  return {
    longest_run_km: 10, longest_run_seconds: 3600,
    fastest_5k_seconds: 1500, fastest_10k_seconds: 3300,
    best_pace_seconds_per_km: 300, most_kcal_run: 600,
    best_week_run_km: 25,
    longest_walk_km: 5, longest_walk_seconds: 3600, most_kcal_walk: 200,
    longest_workout_seconds: 5400, most_kcal_workout: 800, most_exercises_workout: 8,
    longest_streak_days: 14, streak_days_30d: 7,
  };
}

describe("HealthAndStatsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatsOverview.mockResolvedValue(makeStats());
    mockGetSessions.mockResolvedValue(makeSessions());
    mockGetWeightEntries.mockResolvedValue(makeWeights());
    mockGetBmi.mockResolvedValue(makeBmi());
    mockGetPrs.mockResolvedValue(makePrs());
    mockGetBoxingStats.mockResolvedValue(null);
    mockGetBoxingPrs.mockResolvedValue(null);
    mockGetBoxingTrends.mockResolvedValue(null);
    mockGetGoalProgress.mockResolvedValue(null);
    mockCreateWeightEntry.mockResolvedValue({});
    mockDeleteWeightEntry.mockResolvedValue(undefined);
    mockGetMeasurements.mockResolvedValue([]);
    mockGetMeasurementChanges.mockResolvedValue({ first: null, latest: null, deltas: {} });
    mockGetWellnessEntries.mockResolvedValue([]);
    mockGetWellnessTrends.mockResolvedValue({ weekly_averages: [] });
    mockGetInjuries.mockResolvedValue([]);
  });

  // ── Smoke tests ──

  it("renders loading skeleton initially", () => {
    render(<HealthAndStatsTab />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders quick stats after data loads", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Consistency (30d)")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
    expect(screen.getByText("Total kcal (30d)")).toBeDefined();
    expect(screen.getByText("1,800")).toBeDefined();
    expect(screen.getByText("Weight chg (30d)")).toBeDefined();
    expect(screen.getByText("-0.5 kg")).toBeDefined();
  });

  it("shows activity streak when prs has streak > 0", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("7 days")).toBeDefined();
  });

  it("shows no streak placeholder when streak is 0", async () => {
    mockGetPrs.mockResolvedValue({ ...makePrs(), streak_days_30d: 0 });
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("no activity yet")).toBeDefined();
  });

  it("renders BMI when available", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("24.5")).toBeDefined();
    expect(screen.getByText("Normal")).toBeDefined();
  });

  it("shows goal progress when goal is set", async () => {
    mockGetGoalProgress.mockResolvedValue({
      start_weight_kg: 85, current_weight_kg: 80.5, goal_weight_kg: 75,
      progress_percentage: 45, remaining_kg: 5.5,
    });
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Goal Progress")).toBeDefined();
    expect(screen.getByText("45%")).toBeDefined();
    expect(screen.getByText("5.5 kg to go")).toBeDefined();
  });

  it("shows goal reached message at 100%", async () => {
    mockGetGoalProgress.mockResolvedValue({
      start_weight_kg: 80, current_weight_kg: 75, goal_weight_kg: 75,
      progress_percentage: 100, remaining_kg: 0,
    });
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Goal reached!")).toBeDefined();
  });

  it("shows placeholder when no goal weight set", async () => {
    mockGetGoalProgress.mockResolvedValue({
      start_weight_kg: null, current_weight_kg: null, goal_weight_kg: null,
      progress_percentage: null, remaining_kg: null,
    });
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Set a goal weight in Settings")).toBeDefined();
  });

  it("shows summary stats cards", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Total workouts")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("Total runs")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Total walks")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("shows log weight input and button", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByPlaceholderText("kg")).toBeDefined();
    const logButtons = screen.getAllByText("Log");
    expect(logButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Key interaction tests ──

  it("logs weight when button is clicked with valid input", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const input = await screen.findByPlaceholderText("kg");
    const buttons = screen.getAllByText("Log");
    const button = buttons[0]; // weight log button (first in DOM order)

    await act(async () => {
      fireEvent.change(input, { target: { value: "79.5" } });
    });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockCreateWeightEntry).toHaveBeenCalledWith({ weight_kg: 79.5 });
  });

  it("logs weight on Enter key", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const input = await screen.findByPlaceholderText("kg");

    await act(async () => {
      fireEvent.change(input, { target: { value: "79.5" } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockCreateWeightEntry).toHaveBeenCalledWith({ weight_kg: 79.5 });
  });

  it("does not call createWeightEntry when input is empty", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const buttons = await screen.findAllByText("Log");
    const button = buttons[0]; // weight log button
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockCreateWeightEntry).not.toHaveBeenCalled();
  });

  it("shows recent weights when available", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Recent Weights")).toBeDefined();
    expect(screen.getByText("80.5 kg")).toBeDefined();
    expect(screen.getByText("81.0 kg")).toBeDefined();
  });

  it("deletes weight entry on del button click", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const delButtons = await screen.findAllByText("del");
    await act(async () => {
      fireEvent.click(delButtons[0]);
    });
    expect(mockDeleteWeightEntry).toHaveBeenCalledWith(1);
  });

  it("shows personal records when prs is available", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Personal Records")).toBeDefined();
  });

  it("shows coach insight for increased activity", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText(/exercised 20% more this month/)).toBeDefined();
  });

  it("toggles measurements section open and closed", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const measButton = await screen.findByText("Body Measurements");

    // Initially closed
    const downIcons = screen.getAllByTestId("icon-CaretDownIcon");
    expect(downIcons.length).toBeGreaterThan(0);

    // Open
    await act(async () => {
      fireEvent.click(measButton);
    });
    const upIcons = screen.getAllByTestId("icon-CaretUpIcon");
    expect(upIcons.length).toBeGreaterThan(0);

    // Close
    await act(async () => {
      fireEvent.click(measButton);
    });
  });

  it("toggles wellness section open and closed", async () => {
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    const wellnessButton = await screen.findByText("Wellness Check-in");

    // Open
    await act(async () => {
      fireEvent.click(wellnessButton);
    });

    // Close
    await act(async () => {
      fireEvent.click(wellnessButton);
    });
  });

  it("shows error when stats fails", async () => {
    mockGetStatsOverview.mockRejectedValue(new Error("API error"));
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("Failed to load data.")).toBeDefined();
  });

  it("handles zero values gracefully", async () => {
    mockGetStatsOverview.mockResolvedValue({
      ...makeStats(),
      total_kcal_burned: 0, consistency_score_pct: 0,
      avg_weight_change_kg: null, total_sessions_all: 0,
      total_runs: 0, total_walks: 0, current_month_vs_previous_pct: null,
    });
    await act(async () => {
      render(<HealthAndStatsTab />);
    });
    expect(await screen.findByText("0%")).toBeDefined();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  // ── Injury section ──

  it("shows injury section when injuries present", async () => {
    mockGetInjuries.mockResolvedValue([
      { id: 1, body_part: "Left knee", severity: 3, date: "2026-07-20", notes: null, resolved_date: null },
    ]);
    await act(async () => { render(<HealthAndStatsTab />); });
    expect(await screen.findByText("Injury Timeline")).toBeDefined();
  });

  // ── Coach insight scenarios ──

  it("shows no activity streak when 0", async () => {
    mockGetPrs.mockResolvedValue({ ...makePrs(), streak_days_30d: 0, longest_streak_days: 0 });
    await act(async () => { render(<HealthAndStatsTab />); });
    expect(await screen.findByText(/no activity yet/)).toBeDefined();
  });
});
