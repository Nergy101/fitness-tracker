import { useState } from "react";
import {
  BicycleIcon as Bicycle,
  XIcon as X,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, OfflineError } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { ACTIVITY_COLORS } from "../activity";

interface CyclingLoggerProps {
  onWorkoutLogged: () => void;
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

export default function CyclingLogger({ onWorkoutLogged }: CyclingLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [distanceKm, setDistanceKm] = useState("");
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
    setIsCustomDuration(false);
    setDistanceKm("");
    setNotes("");
    setDate(todayStr());
    setNotePrompt(randomNotePrompt());
  }

  async function handleSubmit() {
    const dist = parseFloat(distanceKm);
    const dur = duration;
    if (isNaN(dist) || dist <= 0 || dur <= 0) return;

    try {
      await api.createCycling({
        duration_seconds: dur,
        distance_km: dist,
        date,
        notes,
      });
      setToast("Cycling ride logged!");
      resetForm();
      setShowForm(false);
      onWorkoutLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast("Cycling ride queued for sync");
      } else {
        setToast("Failed to log cycling ride");
      }
    }
  }

  // ── Collapsed state ──
  if (!showForm) {
    return (
      <>
        {toast && (
          <Toast onDismiss={() => setToast(null)}>
            <Bicycle size={18} weight="fill" />
            {toast}
          </Toast>
        )}

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
          style={{ borderColor: ACTIVITY_COLORS.cycling }}
        >
          <Bicycle size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS.cycling }} />
          <p className="text-xs font-semibold text-fg">Cycling</p>
        </button>
      </>
    );
  }

  // ── Form as bottom sheet ──
  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <Bicycle size={18} weight="fill" />
          {toast}
        </Toast>
      )}

      {/* Collapsed button (always visible in grid) */}
      <button
        onClick={() => {
          resetForm();
          setShowForm(true);
        }}
        className="bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
        style={{ borderColor: ACTIVITY_COLORS.cycling }}
      >
        <Bicycle size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS.cycling }} />
        <p className="text-xs font-semibold text-fg">Cycling</p>
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
                  <Bicycle size={18} style={{ color: ACTIVITY_COLORS.cycling }} />
                  <span className="text-sm font-semibold text-fg">Log a Cycling Ride</span>
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
                <p className="text-xs text-fg/50 mb-1.5">Duration</p>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        if (opt.seconds === 0) {
                          setIsCustomDuration(true);
                          setDuration(0);
                        } else {
                          setIsCustomDuration(false);
                          setDuration(opt.seconds);
                          setCustomDuration("");
                        }
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        opt.seconds === 0
                          ? isCustomDuration
                            ? "bg-accent text-bg font-semibold"
                            : "bg-bg text-fg/60 hover:text-fg"
                          : duration === opt.seconds && !isCustomDuration
                            ? "bg-accent text-bg font-semibold"
                            : "bg-bg text-fg/60 hover:text-fg"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isCustomDuration && (
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
                <p className="text-xs text-fg/50 mb-1">Distance (km)</p>
                <input
                  type="number"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="e.g. 24.0"
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

              {/* Summary preview */}
              {parseFloat(distanceKm) > 0 && duration > 0 && (
                <div className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                  <Bicycle size={16} style={{ color: ACTIVITY_COLORS.cycling }} />
                  <span className="text-fg font-semibold">{parseFloat(distanceKm).toFixed(1)} km</span>
                  <span className="text-fg/40 text-xs ml-auto">
                    {formatDuration(duration)}
                  </span>
                </div>
              )}

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
                disabled={!distanceKm || parseFloat(distanceKm) <= 0}
                className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              >
                Save Cycling Ride
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
