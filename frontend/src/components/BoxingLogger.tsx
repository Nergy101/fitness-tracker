import { useState, useEffect } from "react";
import { HandFistIcon as HandFist, PencilIcon as Pencil, TrashIcon as Trash } from "@phosphor-icons/react";
import Toast from "./Toast";
import { api } from "../api";
import type { BoxingEntryResponse } from "../api";
import { formatDuration } from "../format";

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

function parseDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function BoxingLogger({ onWorkoutLogged }: BoxingLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [entries, setEntries] = useState<BoxingEntryResponse[]>([]);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [kcalPerMin, setKcalPerMin] = useState(DEFAULT_KCAL_PER_MIN);
  const [rounds, setRounds] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);

  async function loadEntries() {
    try {
      const data = await api.getBoxing();
      setEntries(data);
    } catch {
      // silently fail — entries are cosmetic
    }
  }

  useEffect(() => { loadEntries(); }, []);

  function resetForm() {
    setDuration(1800);
    setCustomDuration("");
    setKcalPerMin(DEFAULT_KCAL_PER_MIN);
    setRounds(null);
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setEditingId(null);
  }

  function startEdit(entry: BoxingEntryResponse) {
    setEditingId(entry.id);
    setDuration(entry.duration_seconds);
    setCustomDuration("");
    setKcalPerMin(entry.kcal_per_min);
    setRounds(entry.rounds);
    setNotes(entry.notes);
    setDate(parseDate(entry.date));
    setShowForm(true);
  }

  async function handleDelete(entryId: number) {
    setShowConfirmDelete(null);
    try {
      await api.deleteBoxing(entryId);
      setToast("Boxing entry deleted");
      await loadEntries();
      onWorkoutLogged();
    } catch {
      setToast("Failed to delete boxing entry");
    }
  }

  async function handleSubmit() {
    const dur = duration;
    if (dur <= 0) return;

    try {
      if (editingId) {
        await api.updateBoxing(editingId, {
          duration_seconds: dur,
          kcal_per_min: kcalPerMin,
          rounds: rounds || null,
          date,
          notes,
        });
        setToast("Boxing entry updated!");
      } else {
        await api.createBoxing({
          duration_seconds: dur,
          kcal_per_min: kcalPerMin,
          rounds: rounds || null,
          date,
          notes,
        });
        setToast("Boxing workout logged!");
      }

      resetForm();
      setShowForm(false);
      await loadEntries();
      onWorkoutLogged();
    } catch {
      setToast(editingId ? "Failed to update boxing entry" : "Failed to log boxing workout");
    }
  }

  const estimatedKcal = calcKcal(duration, kcalPerMin);

  // ── Collapsed state: show "Log Boxing" button + recent entries list ──
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
          className="w-full bg-surface rounded-xl p-4 border-2 border-fg/20 border-dashed hover:border-accent/40 transition-colors mb-4 flex items-center gap-3"
        >
          <HandFist size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-fg">Log Boxing</p>
            <p className="text-[11px] text-fg/40 mt-0.5">
              Record a boxing session by duration and intensity
            </p>
          </div>
        </button>

        {/* Recent entries list */}
        {entries.length > 0 && (
          <div className="bg-surface rounded-xl p-4 border border-fg/10 mb-4 space-y-2">
            <p className="text-xs text-fg/50 font-medium uppercase tracking-wide mb-2">
              Recent Boxing Sessions
            </p>
            {entries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-1.5 border-b border-fg/5 last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <HandFist size={14} className="text-accent shrink-0" />
                  <div className="truncate">
                    <span className="text-sm text-fg font-medium">
                      {formatDuration(entry.duration_seconds)}
                    </span>
                    {entry.rounds != null && (
                      <span className="text-xs text-fg/40 ml-1">{entry.rounds}r</span>
                    )}
                    <span className="text-xs text-fg/30 ml-2">
                      {formatDate(entry.date)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => startEdit(entry)}
                    aria-label="Edit"
                    className="p-1.5 text-fg/40 hover:text-fg rounded-lg hover:bg-bg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(entry.id)}
                    aria-label="Delete"
                    className="p-1.5 text-fg/40 hover:text-red-400 rounded-lg hover:bg-bg transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Form state (create or edit) ──
  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>
          <HandFist size={18} weight="fill" />
          {toast}
        </Toast>
      )}

      {/* Confirm delete overlay */}
      {showConfirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
             style={{ paddingTop: "max(env(safe-area-inset-top), 68px)" }}
             onClick={() => setShowConfirmDelete(null)}>
          <div
            className="bg-surface rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl border border-fg/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-fg mb-2">Delete boxing entry?</p>
            <p className="text-xs text-fg/50 mb-4">
              This will also remove it from your history. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-bg text-fg/60 hover:text-fg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showConfirmDelete)}
                className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl p-4 border border-accent/20 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HandFist size={18} className="text-accent" />
            <span className="text-sm font-semibold text-fg">
              {editingId ? "Edit Boxing Session" : "Log Boxing"}
            </span>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(false); }}
            className="text-xs text-fg/40 hover:text-fg"
          >
            Cancel
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
            placeholder="How did it feel?"
            className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={duration <= 0}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {editingId ? "Update Boxing Session" : "Save Boxing Workout"}
        </button>
      </div>
    </>
  );
}