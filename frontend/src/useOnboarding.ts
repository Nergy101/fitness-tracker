import { useSyncExternalStore } from "react";
import {
  getOnboardingComplete,
  setOnboardingComplete,
  subscribeOnboarding,
} from "./onboarding";

export interface OnboardingControls {
  complete: boolean;
  markComplete: () => void;
  reset: () => void;
}

/** Reactive access to the shared onboarding-complete store — all consumers
 *  update together when it changes (via useSyncExternalStore). */
export function useOnboarding(): OnboardingControls {
  const complete = useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingComplete,
    getOnboardingComplete,
  );
  return {
    complete,
    markComplete: () => setOnboardingComplete(true),
    reset: () => setOnboardingComplete(false),
  };
}
