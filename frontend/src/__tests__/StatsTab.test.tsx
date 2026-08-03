import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import StatsTab from "../components/StatsTab";
import { dayKey } from "../dateKey";

// Top-level mocks for vi.mock hoisting
const mockGetStatsOverview = vi.fn();
const mockGetRuns = vi.fn();
const mockGetCycling = vi.fn();
const mockGetSessions = vi.fn();
const mockGetWeightEntries = vi.fn();
const mockGetGoalProgress = vi.fn();
const mockGetHealthInsights = vi.fn();
const mockGetDailyActivity = vi.fn();
const mockGetInjuries = vi.fn();

vi.mock("../api", () => ({
  api: {
    getStatsOverview: (...args: unknown[]) => mockGetStatsOverview(...args),
    getRuns: (...args: unknown[]) => mockGetRuns(...args),
    getCycling: (...args: unknown[]) => mockGetCycling(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getWeightEntries: (...args: unknown[]) => mockGetWeightEntries(...args),
    getGoalProgress: (...args: unknown[]) => mockGetGoalProgress(...args),
    getHealthInsights: (...args: unknown[]) => mockGetHealthInsights(...args),
    getDailyActivity: (...args: unknown[]) => mockGetDailyActivity(...args),
    getInjuries: (...args: unknown[]) => mockGetInjuries(...args),
  },
}));

// Inline all phosphor icons
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
  };
});

// Mock useLocale to return stable locale
vi.mock("../useLocale", () => ({
  useLocale: () => ({ locale: "dmy" as const }),
}));

// Fixtures are anchored to the clock: hardcoded dates silently fall out of the
// rolling 7-day daily window a week after they are written.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

function mondayBefore(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

function makeStats() {
  return {
    activity_weekly: [
      {
        week_start: mondayBefore(0),
        workout_minutes: 120, run_minutes: 60, walk_minutes: 30, boxing_minutes: 0, cycling_minutes: 0,
        run_km: 10, walk_km: 3, cycling_km: 0,
        workout_kcal: 500, run_kcal: 400, walk_kcal: 100, boxing_kcal: 0, cycling_kcal: 0,
      },
      {
        week_start: mondayBefore(7),
        workout_minutes: 90, run_minutes: 45, walk_minutes: 20, boxing_minutes: 0, cycling_minutes: 0,
        run_km: 8, walk_km: 2, cycling_km: 0,
        workout_kcal: 400, run_kcal: 300, walk_kcal: 80, boxing_kcal: 0, cycling_kcal: 0,
      },
    ],
    total_kcal_burned: 1800,
    consistency_score_pct: 100,
    consistency_streak_days: 42,
    total_sessions_all: 5,
    total_runs: 3,
    total_walks: 2,
    total_boxing: 0,
    total_cycling: 0,
    current_month_minutes: 300,
    previous_month_minutes: 250,
    current_month_vs_previous_pct: 20,
    avg_weight_change_kg: -0.5,
  };
}

function makeRuns() {
  return [
    {
      id: 1, duration_seconds: 1500, distance_km: 5.0, pace_per_km: 300,
      run_type: "run", date: daysAgo(1), notes: "", created_at: `${daysAgo(1)}T07:00:00`,
    },
    {
      id: 2, duration_seconds: 1440, distance_km: 5.0, pace_per_km: 288,
      run_type: "run", date: daysAgo(5), notes: "", created_at: `${daysAgo(5)}T07:00:00`,
    },
  ];
}

function makeSessions() {
  return [
    {
      id: 1, template_id: 1, template_name: "Morning Routine",
      started_at: `${daysAgo(2)}T08:00:00`, finished_at: `${daysAgo(2)}T08:30:00`,
      total_duration_seconds: 1800, total_kcal_estimated: 200, notes: "",
      boxing_entry_id: null, run_entry_id: null, cycling_entry_id: null, exercises: [],
    },
    {
      id: 2, template_id: null, template_name: "Run: 5.0km",
      started_at: `${daysAgo(1)}T07:00:00`, finished_at: `${daysAgo(1)}T07:25:00`,
      total_duration_seconds: 1500, total_kcal_estimated: 363.8, notes: "",
      boxing_entry_id: null, run_entry_id: 1, cycling_entry_id: null, exercises: [],
    },
  ];
}

function makeWeights() {
  return [
    { id: 1, weight_kg: 80.5, date: daysAgo(2), notes: "", created_at: `${daysAgo(2)}T08:00:00` },
    { id: 2, weight_kg: 81.0, date: daysAgo(9), notes: "", created_at: `${daysAgo(9)}T08:00:00` },
  ];
}

describe("StatsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatsOverview.mockResolvedValue(makeStats());
    mockGetRuns.mockResolvedValue(makeRuns());
    mockGetCycling.mockResolvedValue([]);
    mockGetSessions.mockResolvedValue(makeSessions());
    mockGetWeightEntries.mockResolvedValue(makeWeights());
    mockGetGoalProgress.mockResolvedValue(null);
    mockGetHealthInsights.mockResolvedValue(null);
    mockGetDailyActivity.mockResolvedValue(null);
    mockGetInjuries.mockResolvedValue([]);
  });

  // ── Smoke tests ──

  it("renders loading skeleton initially", () => {
    render(<StatsTab />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders training mix after data loads", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Training Mix")).toBeDefined();
  });

  it("renders activity section with daily/weekly toggle", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Activity")).toBeDefined();
    expect(screen.getByText("Daily")).toBeDefined();
    expect(screen.getByText("Weekly")).toBeDefined();
  });

  it("renders daily activity chart by default", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Daily Activity (min)")).toBeDefined();
  });

  it("renders weight journey chart when entries >= 2", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Weight Journey")).toBeDefined();
  });

  it("renders pace trend when paced runs >= 2", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Run Pace Trend")).toBeDefined();
  });

  it("shows activity legend", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    // Workouts appears in multiple charts (Training Mix, Activity, Energy). Use getAllByText.
    expect((await screen.findAllByText("Workouts")).length).toBeGreaterThan(0);
  });

  it("renders energy burn chart when kcal data present", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Daily Energy Burn (kcal)")).toBeDefined();
  });

  // ── Key interaction tests ──

  it("switches to weekly chart mode on Weekly click", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    const weeklyButton = await screen.findByText("Weekly");

    await act(async () => {
      fireEvent.click(weeklyButton);
    });

    expect(await screen.findByText("Weekly Activity (min)")).toBeDefined();
  });

  it("shows month-over-month comparison in weekly mode", async () => {
    await act(async () => {
      render(<StatsTab />);
    });
    const weeklyButton = await screen.findByText("Weekly");

    await act(async () => {
      fireEvent.click(weeklyButton);
    });

    expect(await screen.findByText("+20%")).toBeDefined();
  });

  it("does not render weight journey when entries < 2", async () => {
    mockGetWeightEntries.mockResolvedValue([
      { id: 1, weight_kg: 80.5, date: "2026-07-25", notes: "", created_at: "2026-07-25T08:00:00Z" },
    ]);
    await act(async () => {
      render(<StatsTab />);
    });
    await screen.findByText("Training Mix");
    expect(screen.queryByText("Weight Journey")).toBeNull();
  });

  it("does not render pace trend when no paced runs", async () => {
    mockGetRuns.mockResolvedValue([]);
    await act(async () => {
      render(<StatsTab />);
    });
    await screen.findByText("Training Mix");
    expect(screen.queryByText("Run Pace Trend")).toBeNull();
  });

  it("shows error when stats fail to load", async () => {
    mockGetStatsOverview.mockRejectedValue(new Error("API error"));
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Failed to load data.")).toBeDefined();
  });

  it("renders distance chart when run data present in recent days", async () => {
    mockGetRuns.mockResolvedValue([
      {
        id: 1, duration_seconds: 1500, distance_km: 5.0, pace_per_km: 300,
        run_type: "run", date: daysAgo(0),
        notes: "", created_at: `${daysAgo(0)}T07:00:00`,
      },
    ]);
    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Daily Distance (km)")).toBeDefined();
  });

  // ── Cycling series ──

  it("draws cycling minutes in the cycling color and labels the legend", async () => {
    const today = daysAgo(0);
    mockGetRuns.mockResolvedValue([]);
    mockGetSessions.mockResolvedValue([
      {
        id: 9, template_id: null, template_name: "Cycling: 12.0km",
        started_at: `${today}T09:00:00`, finished_at: `${today}T09:30:00`,
        total_duration_seconds: 1800, total_kcal_estimated: 320, notes: "",
        boxing_entry_id: null, run_entry_id: null, cycling_entry_id: 4, exercises: [],
      },
    ]);
    mockGetCycling.mockResolvedValue([
      { id: 4, duration_seconds: 1800, distance_km: 12.0, date: today, notes: "", created_at: `${today}T09:00:00Z` },
    ]);

    await act(async () => {
      render(<StatsTab />);
    });
    await screen.findByText("Daily Activity (min)");

    // ACTIVITY_COLORS.cycling — violet-400
    expect(document.querySelectorAll('rect[fill="#a78bfa"]').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cycling").length).toBeGreaterThan(0);
  });

  it("counts a cycling ride's minutes once, not once per mirror session", async () => {
    const today = daysAgo(0);
    mockGetRuns.mockResolvedValue([]);
    mockGetSessions.mockResolvedValue([
      {
        id: 9, template_id: null, template_name: "Cycling: 12.0km",
        started_at: `${today}T09:00:00`, finished_at: `${today}T09:30:00`,
        total_duration_seconds: 1800, total_kcal_estimated: 320, notes: "",
        boxing_entry_id: null, run_entry_id: null, cycling_entry_id: 4, exercises: [],
      },
    ]);
    mockGetCycling.mockResolvedValue([
      { id: 4, duration_seconds: 1800, distance_km: 12.0, date: today, notes: "", created_at: `${today}T09:00:00Z` },
    ]);

    await act(async () => {
      render(<StatsTab />);
    });
    await screen.findByText("Daily Activity (min)");

    // Peak y-axis tick equals the single ride's 30 minutes.
    expect(screen.getAllByText("30m").length).toBeGreaterThan(0);
    expect(screen.queryByText("60m")).toBeNull();
  });

  it("renders cycling distance in the distance chart", async () => {
    const today = daysAgo(0);
    mockGetRuns.mockResolvedValue([]);
    mockGetCycling.mockResolvedValue([
      { id: 4, duration_seconds: 1800, distance_km: 12.0, date: today, notes: "", created_at: `${today}T09:00:00Z` },
    ]);

    await act(async () => {
      render(<StatsTab />);
    });
    expect(await screen.findByText("Daily Distance (km)")).toBeDefined();
    expect(screen.getAllByText("12km").length).toBeGreaterThan(0);
  });
});
