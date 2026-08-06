import { useSyncExternalStore } from "react";
import {
  subscribeInstallPrompt,
  getInstallPromptState,
  promptInstall,
  type InstallPromptState,
} from "./installPrompt";

export interface InstallPromptControls {
  state: InstallPromptState;
  install: () => Promise<"accepted" | "dismissed" | null>;
}

/** Reactive access to the PWA install-prompt store — all consumers update
 *  together when the prompt state changes (via useSyncExternalStore). */
export function useInstallPrompt(): InstallPromptControls {
  const state = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptState,
    getInstallPromptState,
  );
  return { state, install: promptInstall };
}
