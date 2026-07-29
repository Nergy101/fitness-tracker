import { describe, it, expect } from "vitest";
import { niceTicks, ticksByStep, fmtTick } from "../components/health/ticks";

describe("ticks", () => {
  describe("niceTicks", () => {
    it("returns single tick for zero span", () => {
      expect(niceTicks(5, 5)).toEqual([5]);
    });

    it("returns single tick for negative span", () => {
      expect(niceTicks(5, 3)).toEqual([5]);
    });

    it("produces 2-3 round ticks", () => {
      const ticks = niceTicks(0, 100);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(4);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(100);
    });

    it("produces round ticks for small range", () => {
      const ticks = niceTicks(0, 10);
      expect(ticks).toEqual([0, 5, 10]);
    });

    it("produces round ticks for large range", () => {
      const ticks = niceTicks(0, 1000);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(1000);
    });

    it("works with negative range", () => {
      const ticks = niceTicks(-50, 50);
      expect(ticks[0]).toBe(-50);
      expect(ticks[ticks.length - 1]).toBe(50);
    });
  });

  describe("ticksByStep", () => {
    it("generates ticks at fixed interval", () => {
      expect(ticksByStep(0, 60, 10)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    });

    it("starts from ceil of lo", () => {
      expect(ticksByStep(3, 30, 10)).toEqual([10, 20, 30]);
    });

    it("returns empty when lo > hi", () => {
      expect(ticksByStep(50, 10, 10)).toEqual([]);
    });
  });

  describe("fmtTick", () => {
    it("formats thousands with k", () => {
      expect(fmtTick(12000)).toBe("12k");
      expect(fmtTick(1500)).toBe("1.5k");
    });

    it("formats negative thousands", () => {
      expect(fmtTick(-12000)).toBe("-12k");
    });

    it("formats small numbers with decimals", () => {
      expect(fmtTick(7.25)).toBe("7.3");
    });

    it("formats whole numbers without decimals", () => {
      expect(fmtTick(42)).toBe("42");
    });

    it("formats 0", () => {
      expect(fmtTick(0)).toBe("0");
    });
  });
});