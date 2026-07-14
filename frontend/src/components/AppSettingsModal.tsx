import {
  MoonIcon as Moon,
  SpeakerHighIcon as SpeakerHigh,
  SpeakerSlashIcon as SpeakerSlash,
  SunIcon as Sun,
  SunHorizonIcon as SunHorizon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useTheme, type ThemeMode } from "../useTheme";
import { useAudio } from "../useAudio";
import { useLocale } from "../useLocale";
import type { DateLocale } from "../locale";
import HealthSettingsSection from "./health/HealthSettingsSection";
import BackupSection from "./BackupSection";
import { useOnboarding } from "../useOnboarding";
import { APP_VERSION } from "../version";

type SettingsTab = "general" | "health";

const SUB_TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "health", label: "Health" },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string; ariaLabel: string }[] = [
  { mode: "system", label: "System", ariaLabel: "System theme" },
  { mode: "light", label: "Light", ariaLabel: "Light theme" },
  { mode: "dark", label: "Dark", ariaLabel: "Dark theme" },
];

const LOCALE_OPTIONS: { locale: DateLocale; label: string; ariaLabel: string }[] = [
  { locale: "dmy", label: "D/M", ariaLabel: "Day/month date format" },
  { locale: "mdy", label: "M/D", ariaLabel: "Month/day date format" },
];

const SEGMENT_ON = "bg-accent/15 border-accent/30 text-accent";
const SEGMENT_OFF = "border-fg/10 text-fg/40 hover:text-fg/70";
const SEGMENT =
  "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-lg border transition-colors ";

interface AppSettingsModalProps {
  onClose: () => void;
  /** Called after the health profile was saved (data needs a refetch). */
  onHealthSaved: () => void;
}

export default function AppSettingsModal({ onClose, onHealthSaved }: AppSettingsModalProps) {
  const { theme, mode, setMode } = useTheme();
  const { muted, toggleMuted } = useAudio();
  const { locale, setLocale } = useLocale();
  const { reset: resetOnboarding } = useOnboarding();
  const [subTab, setSubTab] = useState<SettingsTab>("general");

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] border border-fg/10 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + tab bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold">Settings</h2>
            <span className="text-[10px] text-fg/30">v{APP_VERSION}</span>
          </div>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl">&times;</button>
        </div>

        {/* Sub‑tab pills */}
        <div className="flex gap-1.5 mb-4 shrink-0">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors " +
                (subTab === tab.id
                  ? "bg-accent/10 border-accent/20 text-accent"
                  : "border-fg/10 text-fg/40 hover:text-fg/70")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {subTab === "general" && (
            <div className="space-y-3.5">
              {/* Theme */}
              <div>
                <p className="text-xs text-fg/50 mb-1.5">Theme</p>
                <div className="flex gap-1.5">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => setMode(opt.mode)}
                      aria-label={opt.ariaLabel}
                      aria-pressed={mode === opt.mode}
                      className={SEGMENT + (mode === opt.mode ? SEGMENT_ON : SEGMENT_OFF)}
                    >
                      {opt.mode === "system" ? (
                        <SunHorizon size={16} weight="fill" />
                      ) : opt.mode === "dark" ? (
                        <Moon size={16} weight="fill" />
                      ) : (
                        <Sun size={16} weight="fill" />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
                {mode === "system" && (
                  <p className="text-[10px] text-fg/30 mt-1">Following your device: {theme}</p>
                )}
              </div>

              {/* Date format */}
              <div>
                <p className="text-xs text-fg/50 mb-1.5">Date format</p>
                <div className="flex gap-1.5">
                  {LOCALE_OPTIONS.map((opt) => (
                    <button
                      key={opt.locale}
                      onClick={() => setLocale(opt.locale)}
                      aria-label={opt.ariaLabel}
                      aria-pressed={locale === opt.locale}
                      className={
                        SEGMENT + "tabular-nums " +
                        (locale === opt.locale ? SEGMENT_ON : SEGMENT_OFF)
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <label className="flex items-center justify-between gap-2 text-sm py-1 cursor-pointer">
                <span className="flex items-center gap-2 text-fg/80">
                  {muted ? (
                    <SpeakerSlash size={18} className="text-fg/40" weight="fill" />
                  ) : (
                    <SpeakerHigh size={18} className="text-accent" weight="fill" />
                  )}
                  Sound effects
                </span>
                <input
                  type="checkbox"
                  checked={!muted}
                  onChange={toggleMuted}
                  aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                  className="accent-accent"
                />
              </label>

              {/* Backups */}
              <div className="border-t border-fg/10 pt-3.5">
                <BackupSection />
              </div>

              {/* Intro tour */}
              <div className="border-t border-fg/10 pt-3.5">
                <button
                  onClick={() => { resetOnboarding(); onClose(); }}
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  Replay intro tour
                </button>
              </div>
            </div>
          )}

          {subTab === "health" && (
            <div>
              <p className="text-xs text-fg/40 mb-2.5">Health Profile</p>
              <HealthSettingsSection
                onSaved={() => {
                  onHealthSaved();
                  onClose();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}