import { describe, it, expect } from "vitest";
import {
  rangeStart,
  dayKey,
  countsByDay,
  RANGES,
  WEEKDAY_LABELS,
  SINGLE_LETTER,
} from "../components/history/utils";
import type { WorkoutSession } from "../api";

describe("history/utils", () => {
  describe("constants", () => {
    it("WEEKDAY_LABELS starts with Mon", () => {
      expect(WEEKDAY_LABELS[0]).toBe("Mon");
      expect(WEEKDAY_LABELS).toHaveLength(7);
    });

    it("SINGLE_LETTER has 7 entries", () => {
      expect(SINGLE_LETTER).toHaveLength(7);
    });

    it("RANGES has three entries", () => {
      expect(RANGES).toHaveLength(3);
    });
  });

  describe("rangeStart", () => {
    it("returns Monday for 'week' key", () => {
      const start = rangeStart("week");
      expect(start.getDay()).toBe(1); // Monday
    });

    it("returns 7 days ago for '7d' key", () => {
      const start = rangeStart("7d");
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      // Allow 1ms difference
      expect(Math.abs(start.getTime() - sevenDaysAgo.getTime())).toBeLessThan(1000);
    });

    it("returns 30 days ago for '30d' key", () => {
      const start = rangeStart("30d");
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      expect(Math.abs(start.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
    });
  });

  describe("dayKey", () => {
    it("formats date as YYYY-MM-DD", () => {
      const d = new Date(2026, 6, 29); // July 29, 2026
      expect(dayKey(d)).toBe("2026-07-29");
    });

    it("zero-pads single-digit month and day", () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      expect(dayKey(d)).toBe("2026-01-05");
    });
  });

  describe("countsByDay", () => {
    it("groups sessions by day", () => {
      const sessions = [
        {
          id: 1,
          template_name: "Push",
          started_at: "2026-07-29T10:00:00",
        },
        {
          id: 2,
          template_name: "Run: 5km",
          started_at: "2026-07-29T14:00:00",
        },
      ] as WorkoutSession[];

      const counts = countsByDay(sessions);
      expect(counts.has("2026-07-29")).toBe(true);
      const day = counts.get("2026-07-29")!;
      expect(day.workout).toBe(1);
      expect(day.run).toBe(1);
    });

    it("handles different days", () => {
      const sessions = [
        { id: 1, template_name: "Push", started_at: "2026-07-28T10:00:00" },
        { id: 2, template_name: "Pull", started_at: "2026-07-29T10:00:00" },
      ] as WorkoutSession[];

      const counts = countsByDay(sessions);
      expect(counts.size).toBe(2);
      expect(counts.get("2026-07-28")!.workout).toBe(1);
      expect(counts.get("2026-07-29")!.workout).toBe(1);
    });

    it("handles walk and boxing types", () => {
      const sessions = [
        {
          id: 1,
          template_name: "Walk: 3km",
          started_at: "2026-07-29T10:00:00",
        },
        {
          id: 2,
          template_name: "Boxing: 30min",
          started_at: "2026-07-29T10:00:00",
        },
      ] as WorkoutSession[];

      const counts = countsByDay(sessions);
      const day = counts.get("2026-07-29")!;
      expect(day.walk).toBe(1);
      expect(day.boxing).toBe(1);
    });

    it("returns empty map for empty sessions", () => {
      const counts = countsByDay([]);
      expect(counts.size).toBe(0);
    });
  });
});