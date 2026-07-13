import { useState } from "react";
import {
  PersonSimpleTaiChiIcon as PersonSimpleTaiChi,
  BicycleIcon as Bicycle,
  PersonSimpleRunIcon as PersonSimpleRun,
  LightningIcon as Lightning,
  CheckCircleIcon as CheckCircle,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, type QuickActivityType } from "../api";
import { formatDuration } from "../format";

// ─── Activity config ────────────────────────────────────────

interface ActivityConfig {
  type: QuickActivityType;
  label: string;
  description: string;
  defaultKcalPerMin: number;
  Icon: typeof CheckCircle; // any Phosphor icon
}

const ACTIVITIES: ActivityConfig[] = [
  {
    type: "yoga",
    label: "Yoga",
    description: "Log a yoga session by duration and intensity",
    defaultKcalPerMin: 4,
    Icon: PersonSimpleTaiChi as typeof CheckCircle,
  },
  {
    type: "cycling",
    label: "Cycling",
    description: "Record a cycling ride by duration and intensity",
    defaultKcalPerMin: 8,
    Icon: Bicycle as typeof CheckCircle,
  },
  {
    type: "swimming",
    label: "Swimming",
    description: "Track a swim session by duration and intensity",
    defaultKcalPerMin: 9,
    Icon: PersonSimpleRun as typeof CheckCircle,
  },
  {
    type: "hiit",
    label: "HIIT",
    description: "Log a HIIT session by duration and intensity",
    defaultKcalPerMin: 12,
    Icon: Lightning as typeof CheckCircle,
  },
];

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

function calcKcal(durationSeconds: number, kcalPerMin: number): number {
  return Math.round((durationSeconds / 60) * kcalPerMin);
}

// ─── Component ──────────────────────────────────────────────

interface QuickActivityLoggerProps {
  onWorkoutLogged: () => void;
}

export default function QuickActivityLogger({ onWorkoutLogged }: QuickActivityLoggerProps) {
  const [activeActivity, setActiveActivity] = useState<QuickActivityType | null>(null);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [kcalPerMin, setKcalPerMin] = useState(7);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const config = activeActivity ? ACTIVITIES.find((a) => a.type === activeActivity) : null;

  function openForm(activityType: QuickActivityType) {
    const cfg = ACTIVITIES.find((a) => a.type === activityType);
    setActiveActivity(activityType);
    setKcalPerMin(cfg?.defaultKcalPerMin ?? 7);
    setDuration(1800);
    setCustomDuration("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  }

  async function logActivity() {
    if (!activeActivity || duration <= 0) return;

    try {
      await api.createQuickActivity({
        activity_type: activeActivity,
        duration_seconds: duration,
        kcal_per_min: kcalPerMin,
        date,
        notes,
      });

      setToast(`${config?.label ?? "Activity"} logged!`);
      setCustomDuration("");
      setDuration(1800);
      setNotes("");
      setActiveActivity(null);
      onWorkoutLogged();
    } catch {
      setToast("Failed to log activity");
    }
  }

  if (activeActivity && config) {
    const estimatedKcal = calcKcal(duration, kcalPerMin);
    const ActivityIcon = config.Icon;

    return (
      <>
        {toast && (
          <Toast onDismiss={() => setToast(null)}>
            <ActivityIcon size={18} weight="fill" />
            {toast}
          </Toast>
        )}
        <div className="bg-surface rounded-xl p-4 border border-accent/20 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivityIcon size={18} className="text-accent" />
              <span className="text-sm font-semibold text-fg">Log {config.label}</span>
            </div>
            <button
              onClick={() => setActiveActivity(null)}
              className="text-xs text-fg/40 hover:text-fg"
            >
              Cancel
            </button>
          </div>

          {/* Duration quick-select */}
          <div>
            <p className="text-xs text-fg/50 mb-1.5">How long was your {config.label.toLowerCase()} session?</p>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setDuration(opt.seconds);
                    setCustomDuration("");
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    duration === opt.seconds && !customDuration
                      ? "bg-accent text-bg font-semibold"
                      : "bg-bg text-fg/60 hover:text-fg"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duration === 0 && (
              <input
                type="number"
                value={customDuration}
                onChange={(e) => {
                  setCustomDuration(e.target.value);
                  setDuration((parseInt(e.target.value) || 0) * 60);
                }}
                placeholder="Minutes"
                className="mt-2 w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-fg/50 mb-1">Kcal per minute</p>
              <input
                type="number"
                step="0.1"
                value={kcalPerMin}
                onChange={(e) => setKcalPerMin(parseFloat(e.target.value) || 0)}
                className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <p className="text-xs text-fg/50 mb-1">Date</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Kcal preview */}
          <div className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <ActivityIcon size={16} className="text-accent" />
            <span className="text-fg/60">Estimated:</span>
            <span className="text-fg font-semibold">~{estimatedKcal} kcal</span>
            <span className="text-fg/40 text-xs ml-auto">
              {formatDuration(duration)} · {kcalPerMin} kcal/min
            </span>
          </div>

          <div>
            <p className="text-xs text-fg/50 mb-1">Notes (optional)</p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
            />
          </div>

          <button
            onClick={logActivity}
            disabled={duration <= 0}
            className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save {config.label} Session
          </button>
        </div>
      </>
    );
  }

  // Collapsed: show the card buttons
  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <CheckCircle size={18} weight="fill" />
          {toast}
        </Toast>
      )}
      {ACTIVITIES.map((activity) => {
        const Icon = activity.Icon;
        return (
          <button
            key={activity.type}
            onClick={() => openForm(activity.type)}
            className="w-full bg-surface rounded-xl p-4 border-2 border-fg/20 border-dashed hover:border-accent/40 transition-colors mb-4 flex items-center gap-3"
          >
            <Icon size={22} className="text-accent shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold text-fg">Log {activity.label}</p>
              <p className="text-[11px] text-fg/40 mt-0.5">
                {activity.description}
              </p>
            </div>
          </button>
        );
      })}
    </>
  );
}