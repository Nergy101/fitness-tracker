import { useState, useEffect } from "react";
import {
  HandFistIcon as HandFist,
  XIcon as X,
  PencilSimpleIcon as Pencil,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, OfflineError, type BoxingEntryResponse } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { ACTIVITY_COLORS } from "../activity";
import { todayKey } from "../dateKey";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [entries, setEntries] = useState<BoxingEntryResponse[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [kcalPerMin, setKcalPerMin] = useState(DEFAULT_KCAL_PER_MIN);
  const [rounds, setRounds] = useState<number | null>(null);
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());

  async function loadEntries() {
    try {
      const data = await api.getBoxing();
      setEntries(data);
    } catch {
      /* silent — entries are cosmetic */
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function resetForm() {
    setDuration(1800);
    setCustomDuration("");
    setKcalPerMin(DEFAULT_KCAL_PER_MIN);
    setRounds(null);
    setNotes("");
    setDate(todayKey());
    setNotePrompt(randomNotePrompt());
    setEditingId(null);
  }

  function startEdit(entry: BoxingEntryResponse) {
    setEditingId(entry.id);
    const preset = DURATION_OPTIONS.find((o) => o.seconds === entry.duration_seconds);
    if (preset) {
      setDuration(entry.duration_seconds);
      setCustomDuration("");
    } else {
      setDuration(entry.duration_seconds);
      setCustomDuration(String(Math.round(entry.duration_seconds / 60)));
    }
    setKcalPerMin(entry.kcal_per_min);
    setRounds(entry.rounds);
    setDate(entry.date);
    setNotes(entry.notes);
    setShowForm(true);
  }

  async function handleSubmit() {
    const dur = duration;
    if (dur <= 0) return;

    try {
      const data = {
        duration_seconds: dur,
        kcal_per_min: kcalPerMin,
        rounds: rounds || null,
        date,
        notes,
      };
      if (editingId) {
        await api.updateBoxing(editingId, data);
        setToast("Boxing workout updated!");
      } else {
        await api.createBoxing(data);
        setToast("Boxing workout logged!");
      }
      resetForm();
      setShowForm(false);
      await loadEntries();
      onWorkoutLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast("Boxing workout queued for sync");
      } else {
        setToast("Failed to save boxing workout");
      }
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteBoxing(id);
      setShowConfirmDelete(null);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setToast("Boxing workout deleted");
    } catch (e) {
      setShowConfirmDelete(null);
      if (e instanceof OfflineError) {
        setToast("Boxing workout delete queued for sync");
      } else {
        setToast("Failed to delete boxing workout");
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
          className="order-1 bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
          style={{ borderColor: ACTIVITY_COLORS.boxing }}
        >
          <HandFist size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS.boxing }} />
          <p className="text-xs font-semibold text-fg">Boxing</p>
        </button>

        {entries.length > 0 && (
          <div className="col-span-4 order-2 bg-surface rounded-xl p-3 border border-fg/10">
            <p className="text-xs font-semibold text-fg/50 mb-2">Recent Boxing Sessions</p>
            {entries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-fg/5 last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  <HandFist size={14} className="text-accent shrink-0" />
                  <div className="truncate">
                    <span className="text-sm text-fg font-medium">{formatDuration(entry.duration_seconds)}</span>
                    <span className="text-xs text-fg/30 ml-2">
                      {entry.rounds ? `${entry.rounds} rounds` : `${entry.kcal_per_min} kcal/min`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => startEdit(entry)}
                    aria-label="Edit boxing"
                    className="p-1.5 text-fg/40 hover:text-fg rounded-lg hover:bg-bg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(entry.id)}
                    aria-label="Delete boxing"
                    className="p-1.5 text-fg/40 hover:text-red-400 rounded-lg hover:bg-bg transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showConfirmDelete !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            style={{ paddingTop: "max(env(safe-area-inset-top), 68px)" }}
            onClick={() => setShowConfirmDelete(null)}
          >
            <div
              className="bg-surface rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl border border-fg/10"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-fg mb-2">Delete boxing session?</p>
              <p className="text-xs text-fg/50 mb-4">This will also remove it from your history. This action cannot be undone.</p>
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
        className="order-1 bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
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
                  <span className="text-sm font-semibold text-fg">
                    {editingId ? "Edit Boxing Session" : "Log Boxing"}
                  </span>
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
          {editingId ? "Update Boxing Session" : "Save Boxing Workout"}
        </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
