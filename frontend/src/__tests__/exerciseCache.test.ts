import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api";

vi.mock("../auth", () => ({
  getStoredAuth: vi.fn(() => null),
  clearStoredAuth: vi.fn(),
}));

vi.mock("../offlineQueue", () => ({
  enqueueMutation: vi.fn(),
  flushMutations: vi.fn(() => Promise.resolve({ synced: 0, remaining: 0 })),
  getQueue: vi.fn(() => []),
  queueSize: vi.fn(() => 0),
  clearQueue: vi.fn(),
  OUTBOX_SYNCED_EVENT: "outbox-synced",
  OUTBOX_CHANGED_EVENT: "outbox-changed",
}));

const KEY = "fitness_exercises_cache_v1";
const RESPONSE = (r: unknown): Response =>
  ({ ok: true, status: 200, json: () => Promise.resolve(r), text: () => Promise.resolve("") } as Response);

const EX = [{ id: 1, name: "Push-ups" }];
const DAY = 24 * 60 * 60 * 1000;

describe("exercise list cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and caches the list on first load (no cache yet)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(RESPONSE(EX));
    const result = await api.getExercises();
    expect(result).toEqual(EX);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/exercises"),
      expect.any(Object),
    );
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ version: 1, exercises: EX });
  });

  it("serves a fresh cache without any network request", async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, cachedAt: Date.now(), exercises: EX }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(RESPONSE([]));
    const result = await api.getExercises();
    expect(result).toEqual(EX);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves a stale cache immediately and refreshes in the background", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, cachedAt: Date.now() - 100 * DAY, exercises: EX }),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(RESPONSE([{ id: 2, name: "Squats" }]));
    const result = await api.getExercises();
    // Cached list returned synchronously...
    expect(result).toEqual(EX);
    // ...and the background refresh hits the API.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/exercises"),
      expect.any(Object),
    );
    await vi.waitFor(() => {
      expect(JSON.parse(localStorage.getItem(KEY)!).exercises).toEqual([{ id: 2, name: "Squats" }]);
    });
  });

  it("falls back to the API when the cache is corrupted", async () => {
    localStorage.setItem(KEY, "not-json-{{{{");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(RESPONSE(EX));
    const result = await api.getExercises();
    expect(result).toEqual(EX);
    expect(fetch).toHaveBeenCalled();
  });

  it("search queries always hit the API and ignore the cache", async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, cachedAt: Date.now(), exercises: EX }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(RESPONSE([{ id: 9, name: "Cardio" }]));
    const result = await api.getExercises("cardio");
    expect(result).toEqual([{ id: 9, name: "Cardio" }]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/exercises?search="),
      expect.any(Object),
    );
  });
});
