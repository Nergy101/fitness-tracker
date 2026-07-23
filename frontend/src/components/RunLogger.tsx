import { useState } from "react";
import {
  PersonSimpleRunIcon as PersonSimpleRun,
  PersonSimpleWalkIcon as PersonSimpleWalk,
  MapTrifoldIcon as MapTrifold,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import { api } from "../api";
import { formatDuration } from "../format";

interface RunLoggerProps {
  onRunLogged: () => void;
  runType: "run" | "walk";
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

export default function RunLogger({ onRunLogged, runType }: RunLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [runDuration, setRunDuration] = useState(1800);
  const [runCustomDuration, setRunCustomDuration] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [runDistance, setRunDistance] = useState("");
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [runNotes, setRunNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const isRun = runType === "run";
  const Icon = isRun ? PersonSimpleRun : PersonSimpleWalk;
  const label = isRun ? "Run" : "Walk";
  const logLabel = `Log a ${label}`;
  const saveLabel = `Save ${label}`;
  const description = isRun
    ? "Record a completed run with distance, duration, and pace"
    : "Record a walk with distance, duration, and pace";

  function resetForm() {
    setRunDuration(1800);
    setRunCustomDuration("");
    setIsCustomDuration(false);
    setRunDistance("");
    setRunNotes("");
    setRunDate(new Date().toISOString().slice(0, 10));
  }

  async function handleSubmit() {
    const dist = parseFloat(runDistance);
    const dur = runDuration;
    if (isNaN(dist) || dist <= 0 || dur <= 0) return;

    try {
      await api.createRun({
        duration_seconds: dur,
        distance_km: dist,
        run_type: runType,
        date: runDate,
        notes: runNotes,
      });
      setToast(`${label} logged!`);
      resetForm();
      setShowForm(false);
      onRunLogged();
    } catch {
      setToast(`Failed to log ${label.toLowerCase()}`);
    }
  }

  const pace =
    runDuration > 0 && parseFloat(runDistance) > 0
      ? runDuration / parseFloat(runDistance)
      : null;

  // ── Collapsed state ──
  if (!showForm) {
    return (
      <>
        {toast && (
          <Toast onDismiss={() => setToast(null)}>
            <Icon size={18} weight="fill" />
            {toast}
          </Toast>
        )}

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="w-full bg-surface rounded-xl p-4 border-2 border-fg/20 border-dashed hover:border-accent/40 transition-colors mb-4 flex items-center gap-3"
        >
          <Icon size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-fg">{logLabel}</p>
            <p className="text-[11px] text-fg/40 mt-0.5">{description}</p>
          </div>
        </button>
      </>
    );
  }

  // ── Form state ──
  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <Icon size={18} weight="fill" />
          {toast}
        </Toast>
      )}

      <div className="bg-surface rounded-xl p-4 border border-accent/20 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-accent" />
            <span className="text-sm font-semibold text-fg">{logLabel}</span>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(false);
            }}
            className="text-xs text-fg/40 hover:text-fg"
          >
            Cancel
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
                    setRunDuration(0);
                  } else {
                    setIsCustomDuration(false);
                    setRunDuration(opt.seconds);
                    setRunCustomDuration("");
                  }
                }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  opt.seconds === 0
                    ? isCustomDuration
                      ? "bg-accent text-bg font-semibold"
                      : "bg-bg text-fg/60 hover:text-fg"
                    : runDuration === opt.seconds && !runCustomDuration
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
              value={runCustomDuration}
              onChange={(e) => {
                setRunCustomDuration(e.target.value);
                setRunDuration((parseInt(e.target.value) || 0) * 60);
              }}
              placeholder="Minutes"
              className="mt-2 w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-fg/50 mb-1">Distance (km)</p>
            <input
              type="number"
              step="0.1"
              value={runDistance}
              onChange={(e) => setRunDistance(e.target.value)}
              placeholder="e.g. 5.0"
              className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-fg/50 mb-1">Date</p>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="w-full min-w-0 bg-bg border border-fg/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Pace preview */}
        {pace && pace > 0 && (
          <div className="bg-bg rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <MapTrifold size={16} className="text-accent" />
            <span className="text-fg/60">Pace:</span>
            <span className="text-fg font-semibold">{formatPace(pace)}</span>
            <span className="text-fg/40 text-xs ml-auto">
              {formatDuration(runDuration)} · {parseFloat(runDistance).toFixed(1)}km
            </span>
          </div>
        )}

        <div>
          <p className="text-xs text-fg/50 mb-1">Notes (optional)</p>
          <input
            type="text"
            value={runNotes}
            onChange={(e) => setRunNotes(e.target.value)}
            placeholder="How did it feel?"
            className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!runDistance || parseFloat(runDistance) <= 0}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}