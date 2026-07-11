import { describe, it, expect } from "vitest";
import {
  getOnboardingComplete,
  setOnboardingComplete,
  subscribeOnboarding,
} from "../onboarding";

// Module state is a singleton shared across this file — tests run in order
// and end with the flag false (key removed).
describe("onboarding store", () => {
  it("defaults to false when the key is absent", () => {
    expect(localStorage.getItem("onboardingComplete")).toBeNull();
    expect(getOnboardingComplete()).toBe(false);
  });

  it("persists true as '1' and notifies subscribers", () => {
    let notified = 0;
    const unsubscribe = subscribeOnboarding(() => notified++);

    setOnboardingComplete(true);

    expect(getOnboardingComplete()).toBe(true);
    expect(localStorage.getItem("onboardingComplete")).toBe("1");
    expect(notified).toBe(1);

    // Idempotent: same value does not notify again.
    setOnboardingComplete(true);
    expect(notified).toBe(1);

    unsubscribe();
  });

  it("removes the key on reset", () => {
    setOnboardingComplete(false);

    expect(getOnboardingComplete()).toBe(false);
    expect(localStorage.getItem("onboardingComplete")).toBeNull();
  });
});
