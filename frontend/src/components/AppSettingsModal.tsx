import {
  Moon as Moon,
  Speaker as SpeakerHigh,
  VolumeOff as SpeakerSlash,
  Sun as Sun,
  Sunrise as SunHorizon,
  Atom,
  Bolt,
  Box,
  BranchDown,
  CheckList,
  Code2,
  Database,
  Gamepad,
  Globe,
  Layers,
  Monitor,
  Phone,
  Play,
  Rocket,
  ShieldCheck,
  Smileys2,
  TerminalSquare,
  TestTube,
  Wind,
} from "reicon-react";
import { useState } from "react";
import { useTheme, type ThemeMode } from "../useTheme";
import { useAudio } from "../useAudio";
import { useLocale } from "../useLocale";
import type { DateLocale } from "../locale";
import HealthSettingsSection from "./health/HealthSettingsSection";
import BackupSection from "./BackupSection";
import { useOnboarding } from "../useOnboarding";
import { APP_VERSION } from "../version";

type SettingsTab = "general" | "health" | "credits";

const SUB_TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "health", label: "Health" },
  { id: "credits", label: "Credits" },
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

const CREDITS = [
  { icon: Atom, label: "React", desc: "UI framework" },
  { icon: Code2, label: "TypeScript", desc: "Type-safe language" },
  { icon: Bolt, label: "Vite", desc: "Build tool" },
  { icon: Wind, label: "Tailwind CSS", desc: "Utility CSS" },
  { icon: Smileys2, label: "Reicon", desc: "Icon library" },
  { icon: Phone, label: "Workbox (PWA)", desc: "Offline support" },
  { icon: TerminalSquare, label: "Python", desc: "Backend language" },
  { icon: Rocket, label: "FastAPI", desc: "Web framework" },
  { icon: Database, label: "SQLite", desc: "Database" },
  { icon: Layers, label: "SQLAlchemy", desc: "ORM" },
  { icon: BranchDown, label: "Alembic", desc: "Migrations" },
  { icon: Box, label: "Docker", desc: "Containerization" },
  { icon: Globe, label: "Nginx", desc: "Reverse proxy" },
  { icon: Play, label: "GitHub Actions", desc: "CI/CD" },
  { icon: Monitor, label: "Linux", desc: "Server OS" },
  { icon: TestTube, label: "vitest", desc: "Unit tests" },
  { icon: ShieldCheck, label: "pytest", desc: "Backend tests" },
  { icon: Gamepad, label: "Playwright", desc: "E2E tests" },
  { icon: CheckList, label: "Linear", desc: "Project management" },
];

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
                        <SunHorizon size={16} weight="Filled" />
                      ) : opt.mode === "dark" ? (
                        <Moon size={16} weight="Filled" />
                      ) : (
                        <Sun size={16} weight="Filled" />
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
                    <SpeakerSlash size={18} className="text-fg/40" weight="Filled" />
                  ) : (
                    <SpeakerHigh size={18} className="text-accent" weight="Filled" />
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

          {subTab === "credits" && (
            <div className="space-y-1">
              <p className="text-xs text-fg/40 mb-2.5">Built with</p>
              {CREDITS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-fg/5 transition-colors"
                >
                  <item.icon size={20} className="text-fg/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg/80">{item.label}</p>
                    <p className="text-[11px] text-fg/30">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}