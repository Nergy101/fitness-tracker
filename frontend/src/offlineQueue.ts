// Offline write outbox (NER-175).
//
// Persists mutating API requests made while offline and replays them in FIFO
// order when connectivity returns, so logging an activity mid-workout (the
// primary mobile use case) is never lost. Backed by localStorage so the queue
// survives reloads and app restarts.
//
// At-least-once caveat: a request is only queued when `fetch` itself throws
// (offline / DNS / refused), which means it never reached the server, so
// replaying it does not duplicate data. We cannot cover the rare case where
// the request reached the server but the response was lost without a
// server-side idempotency key.

const STORAGE_KEY = "fitness_outbox";
export const OUTBOX_CHANGED_EVENT = "fitness:outbox-changed";
export const OUTBOX_SYNCED_EVENT = "fitness:outbox-synced";

export interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  body?: string;
  createdAt: number;
}

/** How the sender wants the queue to treat a replayed request. */
export type FlushOutcome = "sent" | "drop" | "stop";
export type MutationSender = (m: QueuedMutation) => Promise<FlushOutcome>;

function read(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function write(queue: QueuedMutation[]): void {
  if (queue.length === 0) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(OUTBOX_CHANGED_EVENT, { detail: queue.length }),
    );
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getQueue(): QueuedMutation[] {
  return read();
}

export function queueSize(): number {
  return read().length;
}

// Hard cap so a long offline stint can't grow localStorage without bound.
// Oldest entries are evicted first (FIFO), matching replay order.
const MAX_QUEUE = 500;

export function enqueueMutation(
  method: string,
  url: string,
  body?: string,
): QueuedMutation {
  const item: QueuedMutation = {
    id: makeId(),
    method,
    url,
    body,
    createdAt: Date.now(),
  };
  const queue = read();
  queue.push(item);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  write(queue);
  return item;
}

export function clearQueue(): void {
  write([]);
}

let flushing = false;

/**
 * Replay queued mutations FIFO via `send`. Removes each request that the
 * sender reports as `sent` or `drop`; halts (leaving the request and the rest
 * of the queue intact) on the first `stop`. Single-flight: concurrent calls
 * are ignored while a flush is in progress.
 */
export async function flushMutations(
  send: MutationSender,
): Promise<{ synced: number; remaining: number }> {
  if (flushing) return { synced: 0, remaining: read().length };
  flushing = true;
  let synced = 0;
  try {
    // Re-read each iteration so enqueues during the flush are honored, and
    // remove by id so a shifting queue never drops the wrong entry.
    while (true) {
      const queue = read();
      if (queue.length === 0) break;
      const head = queue[0];
      let outcome: FlushOutcome;
      try {
        outcome = await send(head);
      } catch {
        outcome = "stop";
      }
      if (outcome === "stop") break;
      write(read().filter((m) => m.id !== head.id));
      if (outcome === "sent") synced++;
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: read().length };
}
