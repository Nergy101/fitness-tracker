import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJSON, TimeoutError, OfflineError } from "../api";
import { getStoredAuth, clearStoredAuth } from "../auth";

// Mock auth so we don't need localStorage
vi.mock("../auth", () => ({
  getStoredAuth: vi.fn(() => null),
  clearStoredAuth: vi.fn(),
}));

// Mock offlineQueue to avoid localStorage dependency and verify queue behavior
vi.mock("../offlineQueue", () => ({
  enqueueMutation: vi.fn(),
  flushMutations: vi.fn(() => Promise.resolve({ synced: 0, remaining: 0 })),
  getQueue: vi.fn(() => []),
  queueSize: vi.fn(() => 0),
  clearQueue: vi.fn(),
  OUTBOX_SYNCED_EVENT: "outbox-synced",
  OUTBOX_CHANGED_EVENT: "outbox-changed",
}));

// Mock window.location.reload for 401 handling
const reloadMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { reload: reloadMock },
  writable: true,
});

const MOCK_RESPONSE = {
  ok: true,
  status: 200,
  json: () => Promise.resolve({ data: "ok" }),
  text: () => Promise.resolve(""),
} as Response;

/** A fetch mock that never resolves unless aborted — respects AbortSignal. */
function stalledFetch(): typeof globalThis.fetch {
  return (_input, init) => {
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("The operation was aborted", "AbortError"));
        return;
      }
      const onAbort = () =>
        reject(new DOMException("The operation was aborted", "AbortError"));
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  };
}

describe("fetchJSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON for a successful GET request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(MOCK_RESPONSE);

    const result = await fetchJSON("/api/v1/exercises");

    expect(result).toEqual({ data: "ok" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns undefined for a 204 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ...MOCK_RESPONSE,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
    } as Response);

    const result = await fetchJSON("/api/v1/sessions/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ...MOCK_RESPONSE,
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as Response);

    await expect(fetchJSON("/api/v1/exercises")).rejects.toThrow(
      "API error 500: Internal Server Error",
    );
  });

  it("reloads on 401 and throws Session expired", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ...MOCK_RESPONSE,
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    } as Response);

    await expect(fetchJSON("/api/v1/exercises")).rejects.toThrow(
      "Session expired",
    );
    expect(clearStoredAuth).toHaveBeenCalledOnce();
    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("attaches auth token when stored", async () => {
    vi.mocked(getStoredAuth).mockReturnValue("test-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(MOCK_RESPONSE);

    await fetchJSON("/api/v1/exercises");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/exercises"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("retries once on network error then succeeds", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(MOCK_RESPONSE);

    const result = await fetchJSON("/api/v1/exercises");

    expect(result).toEqual({ data: "ok" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("queues writes on persistent network error and throws OfflineError", async () => {
    const { enqueueMutation } = await import("../offlineQueue");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await expect(
      fetchJSON("/api/v1/sessions", {
        method: "POST",
        body: '{"test":true}',
      }),
    ).rejects.toThrow(OfflineError);

    expect(fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
    expect(enqueueMutation).toHaveBeenCalledWith(
      "POST",
      "/api/v1/sessions",
      '{"test":true}',
    );
  });

  it("throws original error on persistent network error for reads (non-writes)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await expect(fetchJSON("/api/v1/exercises")).rejects.toThrow(
      "Failed to fetch",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts and throws TimeoutError after the timeout", async () => {
    // Mock that respects AbortSignal — when aborted, rejects with AbortError
    vi.spyOn(globalThis, "fetch").mockImplementation(stalledFetch());

    await expect(
      fetchJSON("/api/v1/exercises", {}, 100),
    ).rejects.toThrow(TimeoutError);

    await expect(
      fetchJSON("/api/v1/exercises", {}, 100),
    ).rejects.toThrow("Request timed out after 100ms");

    expect(fetch).toHaveBeenCalledTimes(4); // 2 calls × 2 assertions
  });

  it("retries once on timeout and succeeds if the retry responds", async () => {
    const fetchMock = vi.fn();
    // First call: stalled (honors abort)
    fetchMock.mockImplementationOnce(stalledFetch());
    // Retry: succeeds
    fetchMock.mockResolvedValueOnce(MOCK_RESPONSE);
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    const result = await fetchJSON("/api/v1/exercises", {}, 50);

    expect(result).toEqual({ data: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts a custom timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(stalledFetch());

    await expect(
      fetchJSON("/api/v1/exercises", {}, 200),
    ).rejects.toThrow("Request timed out after 200ms");

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
