import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDateLocale,
  setDateLocale,
  subscribeLocale,
  shortDate,
} from "../locale";

describe("locale", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to default
    setDateLocale("dmy");
  });

  describe("getDateLocale / setDateLocale", () => {
    it("defaults to dmy", () => {
      expect(getDateLocale()).toBe("dmy");
    });

    it("sets and gets mdy", () => {
      setDateLocale("mdy");
      expect(getDateLocale()).toBe("mdy");
    });

    it("no-ops when setting same value", () => {
      const before = getDateLocale();
      setDateLocale(before);
      expect(getDateLocale()).toBe(before);
    });
  });

  describe("subscribeLocale", () => {
    it("notifies listener on change", () => {
      const fn = vi.fn();
      subscribeLocale(fn);
      setDateLocale("mdy");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("returns unsubscribe function", () => {
      const fn = vi.fn();
      const unsub = subscribeLocale(fn);
      unsub();
      setDateLocale("mdy");
      expect(fn).not.toHaveBeenCalled();
    });

    it("does not notify when same value is set", () => {
      const fn = vi.fn();
      subscribeLocale(fn);
      setDateLocale("dmy");
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("shortDate", () => {
    it("formats dmy style", () => {
      const d = new Date(2026, 5, 28); // June 28, 2026
      expect(shortDate(d, "dmy")).toBe("28/6");
    });

    it("formats mdy style", () => {
      const d = new Date(2026, 5, 28);
      expect(shortDate(d, "mdy")).toBe("6/28");
    });

    it("uses current locale when no locale arg", () => {
      setDateLocale("mdy");
      const d = new Date(2026, 0, 15); // Jan 15
      expect(shortDate(d)).toBe("1/15");
    });
  });
});