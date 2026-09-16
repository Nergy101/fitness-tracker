import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";

vi.mock("../api", () => ({
  api: {
    logout: vi.fn(),
    getWorkouts: vi.fn().mockResolvedValue([]),
    getExercises: vi.fn().mockResolvedValue([]),
    getStatsOverview: vi.fn().mockResolvedValue(null),
    getPrs: vi.fn().mockResolvedValue(null),
    getRuns: vi.fn().mockResolvedValue([]),
    getCycling: vi.fn().mockResolvedValue([]),
    getBoxing: vi.fn().mockResolvedValue([]),
  },
  OfflineError: class OfflineError extends Error {},
}));

// App's real children pull in API calls and lazy chunks; only the tab router
// is under test here, so each tab renders a marker.
vi.mock("../components/WorkoutTab", () => ({
  default: () => <div data-testid="workout-tab" />,
}));
vi.mock("../components/ExercisesTab", () => ({
  default: () => <div data-testid="exercises-tab" />,
}));
vi.mock("../components/HistoryTab", () => ({
  default: () => <div data-testid="history-tab" />,
}));
vi.mock("../components/HealthAndStatsTab", () => ({
  default: () => <div data-testid="health-tab" />,
}));
vi.mock("../components/StatsTab", () => ({
  default: () => <div data-testid="stats-tab" />,
}));
vi.mock("../components/WorkoutRunner", () => ({ default: () => null }));
vi.mock("../components/TabataRunner", () => ({ default: () => null }));
vi.mock("../components/AppSettingsModal", () => ({ default: () => null }));
vi.mock("../components/Onboarding", () => ({ default: () => null }));
vi.mock("../components/LoginScreen", () => ({ default: () => null }));
vi.mock("../components/OfflineBanner", () => ({ default: () => null }));
vi.mock("../components/UpdateBanner", () => ({ default: () => null }));
vi.mock("../useTheme", () => ({ useTheme: vi.fn() }));
vi.mock("../useOnboarding", () => ({
  useOnboarding: () => ({ complete: true, markComplete: vi.fn() }),
}));
vi.mock("../useServiceWorkerUpdate", () => ({
  default: () => ({ needRefresh: false, update: vi.fn() }),
}));
vi.mock("../auth", () => ({
  getStoredAuth: () => "token",
  clearStoredAuth: vi.fn(),
}));

describe("App tab routing", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("opens on the middle navigation item", async () => {
    render(<App />);
    // TABS order: Workouts, Exercises, Health, History, Stats.
    expect(await screen.findByTestId("health-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("workout-tab")).not.toBeInTheDocument();
    // The URL is normalized to the default so refresh/back stay consistent.
    expect(window.location.hash).toBe("#health");
  });

  it("still honours an explicit hash on load", async () => {
    window.location.hash = "#stats";
    render(<App />);
    expect(await screen.findByTestId("stats-tab")).toBeInTheDocument();
  });

  it("normalizes an unknown hash to the default tab", async () => {
    window.location.hash = "#nope";
    render(<App />);
    expect(await screen.findByTestId("health-tab")).toBeInTheDocument();
    expect(window.location.hash).toBe("#health");
  });

  it("navigates to another tab on tap", async () => {
    render(<App />);
    await screen.findByTestId("health-tab");

    fireEvent.click(screen.getByRole("button", { name: "Workouts" }));

    expect(await screen.findByTestId("workout-tab")).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#workout"));
  });
});
