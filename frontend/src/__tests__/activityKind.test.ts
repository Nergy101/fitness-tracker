import { describe, it, expect } from "vitest";
import { activityKind } from "../activity";

describe("activityKind", () => {
  it("classifies template names starting with 'Run:' as run", () => {
    expect(activityKind("Run: 5km")).toBe("run");
    expect(activityKind("Run: 10km Long")).toBe("run");
    expect(activityKind("Run: Test")).toBe("run");
  });

  it("classifies template names starting with 'Walk:' as walk", () => {
    expect(activityKind("Walk: 3km")).toBe("walk");
    expect(activityKind("Walk: Evening Stroll")).toBe("walk");
    expect(activityKind("Walk: Treadmill")).toBe("walk");
  });

  it("classifies all other template names as workout", () => {
    expect(activityKind("Full Body")).toBe("workout");
    expect(activityKind("Push-ups")).toBe("workout");
    expect(activityKind("Running")).toBe("workout"); // not prefixed with "Run:"
    expect(activityKind("Walking")).toBe("workout"); // not prefixed with "Walk:"
    expect(activityKind("EMOM Cardio")).toBe("workout");
    expect(activityKind("")).toBe("workout"); // empty string
  });

  it("is case-sensitive — only exact prefixes match", () => {
    expect(activityKind("run: 5km")).toBe("workout"); // lowercase run colon
    expect(activityKind("walk: 2km")).toBe("workout"); // lowercase walk colon
    expect(activityKind("RUN: 5km")).toBe("workout"); // uppercase RUN colon
  });

  it("does not match substrings that overlap the prefix", () => {
    expect(activityKind("Runner's High")).toBe("workout");
    expect(activityKind("Walkabout")).toBe("workout");
    expect(activityKind("Re-Run: Test")).toBe("workout"); // starts with "Re-", not "Run:"
  });
});
