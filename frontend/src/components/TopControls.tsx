import {
  Moon,
  SpeakerHigh,
  SpeakerSlash,
  Sun,
} from "@phosphor-icons/react";
import { useTheme } from "../useTheme";
import { useAudio } from "../useAudio";

interface TopControlsProps {
  /** Larger, higher-contrast buttons for the dark fullscreen runner. */
  variant?: "header" | "overlay";
}

/** Theme toggle + audio mute, shown in the header and during a workout so both
 *  are always reachable. */
export default function TopControls({ variant = "header" }: TopControlsProps) {
  const { theme, toggleTheme } = useTheme();
  const { muted, toggleMuted } = useAudio();

  const size = variant === "overlay" ? 22 : 20;
  const btn =
    "p-1.5 rounded-lg transition-colors " +
    (variant === "overlay"
      ? "text-fg/60 hover:text-fg hover:bg-fg/10"
      : "text-fg/50 hover:text-fg");

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleMuted}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        aria-pressed={muted}
        className={btn}
      >
        {muted ? (
          <SpeakerSlash size={size} weight="fill" />
        ) : (
          <SpeakerHigh size={size} weight="fill" />
        )}
      </button>
      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className={btn}
      >
        {theme === "dark" ? (
          <Sun size={size} weight="fill" />
        ) : (
          <Moon size={size} weight="fill" />
        )}
      </button>
    </div>
  );
}
