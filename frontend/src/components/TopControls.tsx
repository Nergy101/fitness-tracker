import {
  MoonIcon as Moon,
  SpeakerHighIcon as SpeakerHigh,
  SpeakerSlashIcon as SpeakerSlash,
  SunIcon as Sun,
  SunHorizonIcon as SunHorizon,
} from "@phosphor-icons/react";
import { useTheme } from "../useTheme";
import { useAudio } from "../useAudio";

/** Quick mute + theme toggles for the fullscreen workout runner, where the
 *  header settings modal is out of reach. Full settings live in
 *  AppSettingsModal. */
export default function TopControls() {
  const { theme, mode, cycleMode } = useTheme();
  const { muted, toggleMuted } = useAudio();

  const btn = "p-1.5 rounded-lg transition-colors text-fg/60 hover:text-fg hover:bg-fg/10";

  const modeLabel =
    mode === "system"
      ? "System theme"
      : mode === "dark"
        ? "Switch to system theme"
        : "Switch to dark mode";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleMuted}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        aria-pressed={muted}
        className={btn}
      >
        {muted ? (
          <SpeakerSlash size={22} weight="fill" />
        ) : (
          <SpeakerHigh size={22} weight="fill" />
        )}
      </button>
      <button
        onClick={cycleMode}
        aria-label={modeLabel}
        className={btn}
        title={modeLabel}
      >
        {mode === "system" ? (
          <SunHorizon size={22} weight="fill" />
        ) : theme === "dark" ? (
          <Sun size={22} weight="fill" />
        ) : (
          <Moon size={22} weight="fill" />
        )}
      </button>
    </div>
  );
}
