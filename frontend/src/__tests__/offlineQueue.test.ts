import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueMutation,
  flushMutations,
  getQueue,
  queueSize,
  clearQueue,
  OUTBOX_CHANGED_EVENT,
  type QueuedMutation,
  type FlushOutcome,
} from "../offlineQueue";

// A sender that returns a scripted outcome per call and records what it saw,
// so tests can assert FIFO order and that no entry is replayed twice.
function scriptedSender(outcomes: FlushOutcome[]) {
  const seen: QueuedMutation[] = [];
  let i = 0;
  const send = (m: QueuedMutation): Promise<FlushOutcome> => {
    seen.push(m);
    return Promise.resolve(outcomes[i++] ?? "sent");
  };
  return { send, seen };
}

describe("offlineQueue", () => {
  beforeEach(() => {
    clearQueue();
  });

  it("enqueues mutations and reflects them in getQueue/queueSize", () => {
    expect(queueSize()).toBe(0);

    const m = enqueueMutation("POST", "/api/v1/sessions", '{"a":1}');

    expect(queueSize()).toBe(1);
    expect(m.id).toBeTruthy();
    expect(m.createdAt).toBeTypeOf("number");
    expect(getQueue()[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/sessions",
      body: '{"a":1}',
    });
  });

  it("persists across a fresh read (localStorage-backed)", () => {
    enqueueMutation("POST", "/api/v1/runs", "{}");
    // getQueue re-reads localStorage, simulating a reload with no in-memory state.
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].url).toBe("/api/v1/runs");
  });

  it("dispatches OUTBOX_CHANGED_EVENT with the new size on enqueue", () => {
    let lastSize = -1;
    const onChange = (e: Event) => {
      lastSize = (e as CustomEvent<number>).detail;
    };
    window.addEventListener(OUTBOX_CHANGED_EVENT, onChange);
    try {
      enqueueMutation("POST", "/api/v1/weight", "{}");
      expect(lastSize).toBe(1);
    } finally {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, onChange);
    }
  });

  it("replays queued mutations FIFO and drains the queue when all succeed", async () => {
    enqueueMutation("POST", "/api/v1/sessions", "1");
    enqueueMutation("POST", "/api/v1/runs", "2");
    enqueueMutation("POST", "/api/v1/weight", "3");

    const { send, seen } = scriptedSender(["sent", "sent", "sent"]);
    const result = await flushMutations(send);

    expect(seen.map((m) => m.body)).toEqual(["1", "2", "3"]);
    expect(result).toEqual({ synced: 3, remaining: 0 });
    expect(queueSize()).toBe(0);
  });

  it("stops on the first 'stop' and preserves the head and rest (no loss)", async () => {
    enqueueMutation("POST", "/api/v1/sessions", "1");
    enqueueMutation("POST", "/api/v1/runs", "2");

    // Still offline: sender reports stop; nothing should be removed.
    const first = scriptedSender(["stop"]);
    const r1 = await flushMutations(first.send);

    expect(first.seen).toHaveLength(1); // halted after the head
    expect(r1).toEqual({ synced: 0, remaining: 2 });
    expect(getQueue().map((m) => m.body)).toEqual(["1", "2"]);
  });

  it("does not duplicate or lose entries across a failed-then-successful flush", async () => {
    enqueueMutation("POST", "/api/v1/sessions", "1");
    enqueueMutation("POST", "/api/v1/runs", "2");

    // First flush: connection still down -> stop, queue untouched.
    await flushMutations(scriptedSender(["stop"]).send);
    expect(queueSize()).toBe(2);

    // Reconnect: everything sends exactly once, in order.
    const online = scriptedSender(["sent", "sent"]);
    const r = await flushMutations(online.send);

    expect(online.seen.map((m) => m.body)).toEqual(["1", "2"]);
    expect(r).toEqual({ synced: 2, remaining: 0 });
    expect(queueSize()).toBe(0);
  });

  it("drops entries the sender rejects as permanent (4xx) without counting them as synced", async () => {
    enqueueMutation("POST", "/api/v1/sessions", "bad");
    enqueueMutation("POST", "/api/v1/runs", "ok");

    const { send, seen } = scriptedSender(["drop", "sent"]);
    const r = await flushMutations(send);

    expect(seen.map((m) => m.body)).toEqual(["bad", "ok"]);
    expect(r).toEqual({ synced: 1, remaining: 0 });
    expect(queueSize()).toBe(0);
  });

  it("treats a thrown sender error as 'stop' and keeps the queue intact", async () => {
    enqueueMutation("POST", "/api/v1/sessions", "1");

    const boom = (): Promise<FlushOutcome> => Promise.reject(new Error("network"));
    const r = await flushMutations(boom);

    expect(r).toEqual({ synced: 0, remaining: 1 });
    expect(queueSize()).toBe(1);
  });

  it("clearQueue empties the outbox", () => {
    enqueueMutation("POST", "/api/v1/sessions", "1");
    expect(queueSize()).toBe(1);
    clearQueue();
    expect(queueSize()).toBe(0);
  });
});
