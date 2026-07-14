import { useRef, useState } from "react";
import {
  Dumbbell as Barbell,
  CaretLeft as CaretLeft,
  CaretRight as CaretRight,
  ChartBar as ChartBar,
  Gear as Gear,
  HeartPulse as Heartbeat,
  Run as PersonSimpleRun,
} from "reicon-react"
import type { IconComponent } from "reicon-react";;
import { api } from "../api";
import { useLocale } from "../useLocale";
import type { DateLocale } from "../locale";

type Slide =
  | { kind: "info"; icon: IconComponent; title: string; body: string }
  | { kind: "setup" };

const SLIDES: Slide[] = [
  {
    kind: "info",
    icon: Heartbeat,
    title: "Welcome to FitnessTracker",
    body: "Your workouts, runs, and health in one place. Here's a quick tour.",
  },
  {
    kind: "info",
    icon: Barbell,
    title: "Build & run workouts",
    body: "Create timed workout templates and start them with a guided timer. Log runs, walks, and boxing right from the Workouts tab.",
  },
  {
    kind: "info",
    icon: PersonSimpleRun,
    title: "Your exercise library",
    body: "Browse built-in exercises and add your own to drop into any workout.",
  },
  {
    kind: "info",
    icon: ChartBar,
    title: "See your history",
    body: "Every session on a calendar and in charts, so you can spot streaks and trends.",
  },
  {
    kind: "info",
    icon: Heartbeat,
    title: "Track your health",
    body: "Consistency, calories, weight, goals, streaks, and personal records — all on a rolling 30-day view.",
  },
  { kind: "setup" },
  {
    kind: "info",
    icon: Gear,
    title: "You're all set",
    body: "Change theme, profile, and backups anytime from the gear icon. Let's go!",
  },
];

const LOCALE_OPTIONS: { locale: DateLocale; label: string; ariaLabel: string }[] = [
  { locale: "dmy", label: "D/M", ariaLabel: "Day/month date format" },
  { locale: "mdy", label: "M/D", ariaLabel: "Month/day date format" },
];

// Same segmented-control styling as AppSettingsModal (not exported there).
const SEGMENT_ON = "bg-accent/15 border-accent/30 text-accent";
const SEGMENT_OFF = "border-fg/10 text-fg/40 hover:text-fg/70";
const SEGMENT =
  "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-lg border transition-colors ";

interface OnboardingProps {
  onComplete: () => void;
}

/** First-run welcome carousel: swipeable full-screen slides introducing each
 *  app area, plus an optional quick-setup slide (goal weight + date format). */
export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [goalWeight, setGoalWeight] = useState("");
  const { locale, setLocale } = useLocale();
  const touchStartX = useRef<number | null>(null);

  const last = SLIDES.length - 1;
  const go = (n: number) => setStep((s) => Math.min(Math.max(s + n, 0), last));

  const finish = async () => {
    const kg = parseFloat(goalWeight);
    if (!isNaN(kg) && kg > 0) {
      try {
        await api.updateProfile({ goal_weight_kg: kg });
      } catch {
        // Optional setup — don't block finishing the tour on a failed write.
      }
    }
    onComplete();
  };

  const slide = SLIDES[step];

  return (
    <div
      className="fixed inset-0 z-[60] bg-bg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      {/* Top bar: Skip */}
      <div
        className="flex justify-end px-4 pb-1 shrink-0"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
      >
        <button
          onClick={onComplete}
          className="text-sm text-fg/40 hover:text-fg/70 transition-colors px-3 py-2"
        >
          Skip
        </button>
      </div>

      {/* Slide body (swipeable) */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto"
        onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touchStartX.current ?? 0);
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        {slide.kind === "info" ? (
          <div className="flex flex-col items-center text-center max-w-xs">
            <div className="w-20 h-20 bg-accent/15 rounded-3xl flex items-center justify-center mb-6">
              <slide.icon size={40} className="text-accent" weight="Filled" />
            </div>
            <h2 className="text-2xl font-bold text-fg mb-3">{slide.title}</h2>
            <p className="text-sm text-fg/60 leading-relaxed">{slide.body}</p>
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <h2 className="text-2xl font-bold text-fg mb-1 text-center">Quick setup</h2>
            <p className="text-sm text-fg/60 mb-6 text-center">
              Optional — you can change these later in Settings.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="onboarding-goal-weight" className="text-xs text-fg/50 block mb-1">
                  Goal weight (kg)
                </label>
                <input
                  id="onboarding-goal-weight"
                  type="number"
                  step="0.1"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  placeholder="e.g. 75.0"
                  className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50"
                />
              </div>
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
            </div>
          </div>
        )}
      </div>

      {/* Page dots */}
      <div className="flex items-center justify-center gap-1.5 py-4 shrink-0">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? "bg-accent w-4" : "bg-fg/20 w-1.5"
            }`}
          />
        ))}
      </div>

      {/* Bottom controls */}
      <div
        className="flex items-center justify-between px-6 shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="flex items-center gap-1 text-sm font-medium text-fg/50 hover:text-fg/80 transition-colors py-3 px-2 disabled:opacity-0"
        >
          <CaretLeft size={16} />
          Back
        </button>
        {step === last ? (
          <button
            onClick={finish}
            className="bg-accent text-on-accent rounded-xl py-3 px-6 font-semibold hover:bg-accent-hover transition-colors"
          >
            Get started
          </button>
        ) : (
          <button
            onClick={() => go(1)}
            className="flex items-center gap-1 bg-accent text-on-accent rounded-xl py-3 px-6 font-semibold hover:bg-accent-hover transition-colors"
          >
            Next
            <CaretRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
