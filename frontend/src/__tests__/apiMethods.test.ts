import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api";

// Mock auth to avoid localStorage
vi.mock("../auth", () => ({
  getStoredAuth: vi.fn(() => null),
  clearStoredAuth: vi.fn(),
}));

// Mock offlineQueue
vi.mock("../offlineQueue", () => ({
  enqueueMutation: vi.fn(),
  flushMutations: vi.fn(() => Promise.resolve({ synced: 0, remaining: 0 })),
  getQueue: vi.fn(() => []),
  queueSize: vi.fn(() => 0),
  clearQueue: vi.fn(),
  OUTBOX_SYNCED_EVENT: "outbox-synced",
  OUTBOX_CHANGED_EVENT: "outbox-changed",
}));

const MOCK_RESPONSE = (result: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(result),
    text: () => Promise.resolve(""),
  } as Response);

describe("api methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mock(result: unknown = { data: "ok" }) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(MOCK_RESPONSE(result));
  }

  function expectGet(path: string) {
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.any(Object),
    );
  }

  function expectPost(path: string) {
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({ method: "POST" }),
    );
  }

  // ── Workouts ──
  it("getWorkouts", async () => { mock([]); await api.getWorkouts(); expectGet("/api/v1/workouts"); });
  it("createWorkout", async () => { mock({ id: 1 }); await api.createWorkout({ name: "Test", description: "", rounds: 1, rest_between_rounds: 30, exercises: [] }); expectPost("/api/v1/workouts"); });
  it("getWorkout", async () => { mock({}); await api.getWorkout(1); expectGet("/api/v1/workouts/1"); });

  // ── Exercises ──
  it("getExercises", async () => { mock([]); await api.getExercises(); expectGet("/api/v1/exercises"); });
  it("getExercise", async () => { mock({}); await api.getExercise(1); expectGet("/api/v1/exercises/1"); });

  // ── Sessions ──
  it("getSessions", async () => { mock([]); await api.getSessions(); expectGet("/api/v1/sessions"); });
  it("getSessions with limit", async () => { mock([]); await api.getSessions({ limit: 10 }); expectGet("limit=10"); });
  it("getSession", async () => { mock({}); await api.getSession(1); expectGet("/api/v1/sessions/1"); });

  // ── Runs ──
  it("getRuns", async () => { mock([]); await api.getRuns(); expectGet("/api/v1/runs"); });
  it("createRun", async () => {
    mock({ id: 1 });
    await api.createRun({ duration_seconds: 1800, distance_km: 5, run_type: "run", date: "2026-07-29" });
    expectPost("/api/v1/runs");
  });

  // ── Boxing ──
  it("getBoxing", async () => { mock([]); await api.getBoxing(); expectGet("/api/v1/boxing"); });
  it("createBoxing", async () => {
    mock({ id: 1 });
    await api.createBoxing({ duration_seconds: 1800, rounds: 10, date: "2026-07-29" });
    expectPost("/api/v1/boxing");
  });

  // ── Wellness ──
  it("getWellnessEntries", async () => { mock([]); await api.getWellnessEntries(); expectGet("/api/v1/health/wellness"); });
  it("createWellnessEntry", async () => {
    mock({ id: 1 });
    await api.createWellnessEntry({ mood: 3, energy: 3, stress: 3, sleep_hours: 7 });
    expectPost("/api/v1/health/wellness");
  });
  it("getWellnessTrends", async () => { mock({ weekly_averages: [] }); await api.getWellnessTrends(); expectGet("/api/v1/health/wellness/trends"); });

  // ── Injuries ──
  it("getInjuries", async () => { mock([]); await api.getInjuries(); expectGet("/api/v1/health/injuries"); });
  it("createInjury", async () => { mock({ id: 1 }); await api.createInjury({ body_part: "knee", severity: 3 }); expectPost("/api/v1/health/injuries"); });
  it("getInjuries activeOnly=true", async () => { mock([]); await api.getInjuries(true); expectGet("active_only=true"); });

  // ── Measurements ──
  it("getMeasurements", async () => { mock([]); await api.getMeasurements(); expectGet("/api/v1/health/measurements"); });
  it("createMeasurement", async () => { mock({ id: 1 }); await api.createMeasurement({ waist_cm: 80 }); expectPost("/api/v1/health/measurements"); });
  it("getMeasurementChanges", async () => { mock({ first: null, latest: null, deltas: {} }); await api.getMeasurementChanges(); expectGet("/api/v1/health/measurements/changes"); });

  // ── Weight ──
  it("getWeightEntries", async () => { mock([]); await api.getWeightEntries(); expectGet("/api/v1/health/weight"); });
  it("getWeightStreak", async () => { mock({ streak: 0, latest_date: null }); await api.getWeightStreak(); expectGet("/api/v1/health/weight/streak"); });
  it("getWeightStats", async () => { mock({}); await api.getWeightStats(); expectGet("/api/v1/health/weight/stats"); });

  // ── PRs / Stats ──
  it("getPrs", async () => { mock({}); await api.getPrs(); expectGet("/api/v1/health/prs"); });
  it("getStatsOverview", async () => { mock({}); await api.getStatsOverview(); expectGet("/api/v1/stats/overview"); });
  it("getBoxingStats", async () => { mock({}); await api.getBoxingStats(); expectGet("/api/v1/boxing/stats"); });

  // ── Health / Import ──
  it("getHealthWorkouts", async () => { mock({ workouts: [] }); await api.getHealthWorkouts(); expectGet("/api/v1/import/workouts"); });
  it("getMetricNames", async () => { mock({ metrics: [] }); await api.getMetricNames(); expectGet("/api/v1/import/metric-names"); });
  it("getDailyActivity", async () => { mock({ days: [] }); await api.getDailyActivity(); expectGet("/api/v1/stats/daily-activity"); });

  // ── Update / Delete methods ──

  function expectPatch(path: string) {
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({ method: "PATCH" }),
    );
  }

  function expectDelete(path: string) {
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({ method: "DELETE" }),
    );
  }

  it("updateSession", async () => { mock({}); await api.updateSession(1, { notes: "updated" }); expectPatch("/api/v1/sessions/1"); });
  it("deleteSession", async () => { mock(undefined); await api.deleteSession(1); expectDelete("/api/v1/sessions/1"); });
  it("updateRun", async () => { mock({}); await api.updateRun(1, { duration_seconds: 900, distance_km: 3 }); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/runs/1"), expect.any(Object)); });
  it("deleteRun", async () => { mock(undefined); await api.deleteRun(1); expectDelete("/api/v1/runs/1"); });
  it("updateBoxing", async () => { mock({}); await api.updateBoxing(1, { duration_seconds: 900 }); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/boxing/1"), expect.any(Object)); });
  it("deleteBoxing", async () => { mock(undefined); await api.deleteBoxing(1); expectDelete("/api/v1/boxing/1"); });
  it("updateInjury", async () => { mock({}); await api.updateInjury(1, { resolved_date: "2026-07-30" }); expectPatch("/api/v1/health/injuries/1"); });
  it("deleteInjury", async () => { mock(undefined); await api.deleteInjury(1); expectDelete("/api/v1/health/injuries/1"); });
  it("updateMeasurement", async () => { mock({}); await api.updateMeasurement(1, { waist_cm: 82 }); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/health/measurements/1"), expect.any(Object)); });
  it("deleteMeasurement", async () => { mock(undefined); await api.deleteMeasurement(1); expectDelete("/api/v1/health/measurements/1"); });
  it("createWeightEntry", async () => { mock({}); await api.createWeightEntry({ date: "2026-07-29", weight_kg: 80 }); expectPost("/api/v1/health/weight"); });
  it("deleteWeightEntry", async () => { mock(undefined); await api.deleteWeightEntry(1); expectDelete("/api/v1/health/weight/1"); });
  it("updateProfile", async () => { mock({}); await api.updateProfile({ goal_weight_kg: 75 }); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/health/profile"), expect.any(Object)); });
  it("getHealthScore", async () => { mock({}); await api.getHealthScore(); expectGet("/api/v1/health/score"); });
  it("getGoalProgress", async () => { mock(null); await api.getGoalProgress(); expectGet("/api/v1/health/goal-progress"); });
  it("getRunStats", async () => { mock({}); await api.getRunStats(); expectGet("/api/v1/runs/stats"); });
  it("getBoxingPrs", async () => { mock({}); await api.getBoxingPrs(); expectGet("/api/v1/boxing/prs"); });
  it("getBoxingTrends", async () => { mock([]); await api.getBoxingTrends(); expectGet("/api/v1/boxing/stats/trends"); });
  it("getHealthInsights", async () => { mock({ series: [] }); await api.getHealthInsights(); expectGet("/api/v1/import/insights"); });
  it("getExerciseLogs", async () => { mock([]); await api.getExerciseLogs(1); expectGet("/api/v1/exercises/1/logs"); });
  it("togglePin", async () => { mock({}); await api.togglePin(1, true); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/workouts/1/pin"), expect.any(Object)); });
  it("duplicateWorkout", async () => { mock({ id: 2 }); await api.duplicateWorkout(1); expectPost("/api/v1/workouts/1/duplicate"); });

  it("downloadExport", async () => {
    const blob = new Blob(["date,weight_kg\n"], { type: "text/csv" });
    const headers = new Headers({ "content-disposition": 'attachment; filename="weights.csv"' });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob), headers } as Response);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    const clickSpy = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      el.click = clickSpy;
      return el;
    });

    await api.downloadExport("weights");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/export/weights"), expect.any(Object));
    expect(clickSpy).toHaveBeenCalled();
  });

  // ── Profile ──
  it("getProfile", async () => { mock({}); await api.getProfile(); expectGet("/api/v1/health/profile"); });
  it("getBmi", async () => { mock({}); await api.getBmi(); expectGet("/api/v1/health/bmi"); });
});