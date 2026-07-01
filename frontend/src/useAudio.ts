import { useState } from "react";
import { isMuted, setMuted } from "./sound";

export interface AudioControls {
  muted: boolean;
  toggleMuted: () => void;
}

/** Reactive wrapper over the shared mute flag in sound.ts. */
export function useAudio(): AudioControls {
  const [muted, setMutedState] = useState(isMuted);

  return {
    muted,
    toggleMuted: () => {
      const next = !muted;
      setMuted(next);
      setMutedState(next);
    },
  };
}
