import { describe, it, expect, beforeEach } from "vitest";
import { getStoredAuth, setStoredAuth, clearStoredAuth } from "../auth";

describe("auth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no token is stored", () => {
    expect(getStoredAuth()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setStoredAuth("test-token-123");
    expect(getStoredAuth()).toBe("test-token-123");
  });

  it("clears a stored token", () => {
    setStoredAuth("test-token-123");
    clearStoredAuth();
    expect(getStoredAuth()).toBeNull();
  });

  it("overwrites an existing token", () => {
    setStoredAuth("old-token");
    setStoredAuth("new-token");
    expect(getStoredAuth()).toBe("new-token");
  });

  it("clearStoredAuth is safe when no token exists", () => {
    clearStoredAuth();
    expect(getStoredAuth()).toBeNull();
  });
});