// Shared fetch client for the FitnessTracker FastAPI backend: base URL,
// auth header injection, timeouts/retries, offline-outbox queuing, and
// pagination helpers. Domain modules build on top of `fetchJSON`.

import { getStoredAuth, clearStoredAuth } from "../auth";
import {
  enqueueMutation,
  flushMutations,
  OUTBOX_SYNCED_EVENT,
  type QueuedMutation,
  type FlushOutcome,
} from "../offlineQueue";

// Empty string → same-origin relative requests (Docker: nginx proxies /api to
// the backend). Unset → localhost:8000 for `npm run dev` convenience.
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Thrown when a mutating request is queued offline instead of sent. */
export class OfflineError extends Error {
  readonly offline = true;
  constructor(
    message = "You're offline — saved on this device and will sync when you reconnect.",
  ) {
    super(message);
    this.name = "OfflineError";
  }
}

/** Thrown when a request exceeds its timeout. */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Writes that must not be queued for offline replay: large Apple Health
// imports, backup/restore, and push-subscription changes are online-only.
const NON_QUEUEABLE_PREFIXES = [
  "/api/v1/import/",
  "/api/v1/backup",
  "/api/v1/backups",
  "/api/v1/settings/backup",
  "/api/v1/notifications/",
];

function isQueueableWrite(method: string, url: string): boolean {
  if (!WRITE_METHODS.has(method)) return false;
  if (!url.startsWith("/api/v1/")) return false;
  return !NON_QUEUEABLE_PREFIXES.some((p) => url.startsWith(p));
}

async function sendQueued(m: QueuedMutation): Promise<FlushOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredAuth();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${m.url}`, {
      method: m.method,
      headers,
      body: m.body,
    });
  } catch {
    return "stop"; // still offline — retry on the next online event
  }
  if (res.ok || res.status === 204) return "sent";
  if (res.status === 401) {
    // Token expired/revoked: clearing it stops an endless retry loop and
    // prompts re-login on the next foregrounding.
    clearStoredAuth();
    return "stop";
  }
  // Rate-limit / server errors are transient: stop and retry later.
  if (res.status === 429 || res.status >= 500) return "stop";
  return "drop"; // 4xx client error — replaying won't help, discard
}

/** Replay queued offline writes; fires OUTBOX_SYNCED_EVENT when some land. */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  const result = await flushMutations(sendQueued);
  if (result.synced > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OUTBOX_SYNCED_EVENT, { detail: result }));
  }
  return result;
}

// Replay when connectivity returns and once on load (a persisted queue may
// remain from a previous offline session).
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushOutbox();
  });
  if (navigator.onLine) void flushOutbox();
}

async function fetchWithTimeout(
  fetchFn: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJSON<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
  onResponse?: (res: Response) => void,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach auth token if stored
  const token = getStoredAuth();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const doFetch = (signal?: AbortSignal) =>
    fetch(`${API_BASE}${url}`, { ...options, headers, signal });

  const method = (options.method ?? "GET").toUpperCase();

  const attempt = async (): Promise<Response> => {
    try {
      return await fetchWithTimeout(doFetch, timeoutMs);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError(timeoutMs);
      }
      throw err;
    }
  };

  // One retry for network errors (offline, DNS, connection refused) and
  // timeouts (stalled connections on flaky mobile networks).
  let res: Response;
  try {
    res = await attempt();
  } catch {
    await delay(1000);
    try {
      res = await attempt();
    } catch (err2) {
      // Still unreachable. Persist mutating requests to the offline outbox so
      // they replay when connectivity returns (NER-175); reads just fail.
      if (isQueueableWrite(method, url)) {
        enqueueMutation(
          method,
          url,
          typeof options.body === "string" ? options.body : undefined,
        );
        throw new OfflineError();
      }
      throw err2;
    }
  }

  // Handle 401 — clear auth and redirect to login
  if (res.status === 401) {
    clearStoredAuth();
    window.location.reload();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  onResponse?.(res);
  return (await res.json()) as T;
}

/** Server-side pagination result: the page items plus the total row count
 *  reported by the `X-Total-Count` header (NER-230). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Fetch a paginated list endpoint. Appends limit/offset to `url` and reads
 *  `X-Total-Count` from the response to compute `hasMore`. */
export async function fetchJSONPage<T>(
  url: string,
  limit: number,
  offset: number,
  options: RequestInit = {},
): Promise<Paginated<T>> {
  const sep = url.includes("?") ? "&" : "?";
  const pagedUrl = `${url}${sep}limit=${limit}&offset=${offset}`;
  let total = 0;
  const items = await fetchJSON<T[]>(pagedUrl, options, 15000, (res) => {
    const header = res.headers.get("X-Total-Count");
    if (header !== null) total = parseInt(header, 10) || 0;
  });
  return { items, total, limit, offset, hasMore: offset + items.length < total };
}

// Auth — best-effort server-side token revocation on logout.
export async function logout(): Promise<void> {
  const token = getStoredAuth();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* offline / unreachable — the local token is cleared regardless */
  }
}
