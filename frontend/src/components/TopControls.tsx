import {
  MoonIcon as Moon,
  SpeakerHighIcon as SpeakerHigh,
  SpeakerSlashIcon as SpeakerSlash,
  SunIcon as Sun,
  SunHorizonIcon as SunHorizon,
} from "@phosphor-icons/react";
import { useTheme } from "../useTheme";
import { useAudio } from "../useAudio";
import { useLocale } from "../useLocale";

interface TopControlsProps {
  /** Larger, higher-contrast buttons for the dark fullscreen runner. */
  variant?: "header" | "overlay";
}

/** Theme toggle + audio mute, shown in the header and during a workout so both
 *  are always reachable. */
export default function TopControls({ variant = "header" }: TopControlsProps) {
  const { theme, mode, cycleMode } = useTheme();
  const { muted, toggleMuted } = useAudio();
  const { locale, toggleLocale } = useLocale();

  const size = variant === "overlay" ? 22 : 20;
  const btn =
    "p-1.5 rounded-lg transition-colors " +
    (variant === "overlay"
      ? "text-fg/60 hover:text-fg hover:bg-fg/10"
      : "text-fg/50 hover:text-fg");

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
          <SpeakerSlash size={size} weight="fill" />
        ) : (
          <SpeakerHigh size={size} weight="fill" />
        )}
      </button>
      <button
        onClick={toggleLocale}
        aria-label={`Date format ${locale === "dmy" ? "day/month" : "month/day"} — tap to switch`}
        className={btn + " text-xs font-semibold tabular-nums"}
        style={{ minWidth: size + 12 }}
      >
        {locale === "dmy" ? "D/M" : "M/D"}
      </button>
      <button
        onClick={cycleMode}
        aria-label={modeLabel}
        className={btn}
        title={modeLabel}
      >
        {mode === "system" ? (
          <SunHorizon size={size} weight="fill" />
        ) : theme === "dark" ? (
          <Sun size={size} weight="fill" />
        ) : (
          <Moon size={size} weight="fill" />
        )}
      </button>
    </div>
  );
}