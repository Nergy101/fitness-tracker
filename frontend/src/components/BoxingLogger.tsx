import { useState } from "react";
import { HandFistIcon as HandFist, XIcon as X } from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, OfflineError } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { ACTIVITY_COLORS } from "../activity";

interface BoxingLoggerProps {
  onWorkoutLogged: () => void;
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

// Average cardio boxing: ~10 kcal/min (moderate-to-vigorous intensity).
const DEFAULT_KCAL_PER_MIN = 10;

function calcKcal(durationSeconds: number, kcalPerMin: number): number {
  return Math.round((durationSeconds / 60) * kcalPerMin);
}

export default function BoxingLogger({ onWorkoutLogged }: BoxingLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [kcalPerMin, setKcalPerMin] = useState(DEFAULT_KCAL_PER_MIN);
  const [rounds, setRounds] = useState<number | null>(null);
  // Local date helper — avoids UTC day-shift from toISOString()
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());

  function resetForm() {
    setDuration(1800);
    setCustomDuration("");
    setKcalPerMin(DEFAULT_KCAL_PER_MIN);
    setRounds(null);
    setNotes("");
    setDate(todayStr());
    setNotePrompt(randomNotePrompt());
  }

  async function handleSubmit() {
    const dur = duration;
    if (dur <= 0) return;

    try {
      await api.createBoxing({
        duration_seconds: dur,
        kcal_per_min: kcalPerMin,
        rounds: rounds || null,
        date,
        notes,
      });
      setToast("Boxing workout logged!");
      resetForm();
      setShowForm(false);
      onWorkoutLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast("Boxing workout queued for sync");
      } else {
        setToast("Failed to log boxing workout");
      }
    }
  }

  const estimatedKcal = calcKcal(duration, kcalPerMin);

  // ── Collapsed state: show "Log Boxing" button ──
  if (!showForm) {
    return (
      <>
        {toast && (
          <Toast onDismiss={() => setToast(null)}>
            <HandFist size={18} weight="fill" />
            {toast}
          </Toast>
        )}

        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
          style={{ borderColor: ACTIVITY_COLORS.boxing }}
        >
          <HandFist size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS.boxing }} />
          <p className="text-xs font-semibold text-fg">Boxing</p>
        </button>
      </>
    );
  }

  // ── Form as bottom sheet ──
  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <HandFist size={18} weight="fill" />
          {toast}
        </Toast>
      )}

      {/* Collapsed button (always visible in grid) */}
      <button
        onClick={() => { resetForm(); setShowForm(true); }}
        className="bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
        style={{ borderColor: ACTIVITY_COLORS.boxing }}
      >
        <HandFist size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS.boxing }} />
        <p className="text-xs font-semibold text-fg">Boxing</p>
      </button>

      {/* Bottom sheet overlay */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={() => { resetForm(); setShowForm(false); }}
        >
          <div
            className="bg-surface rounded-t-2xl w-full max-h-[85vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HandFist size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-fg">Log Boxing</span>
                </div>
                <button
                  onClick={() => { resetForm(); setShowForm(false); }}
                  aria-label="Close"
                  className="text-fg/40 hover:text-fg/70"
                >
                  <X size={18} />
                </button>
              </div>

        {/* Duration quick-select */}
        <div>
          <p className="text-xs text-fg/50 mb-1.5">How long did you box?</p>
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
            className="w-full max-w-full min-w-0 box-border bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-fg/50 mb-1">Rounds (optional)</p>
            <input
              type="number"
              min="1"
              step="1"
              value={rounds ?? ""}
              onChange={(e) => setRounds(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 10"
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Kcal preview */}
        <div className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
          <HandFist size={16} className="text-accent" />
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
            placeholder={notePrompt}
            aria-label="Notes"
            className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={duration <= 0}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          Save Boxing Workout
        </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
