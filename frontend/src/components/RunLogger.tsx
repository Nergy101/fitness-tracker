import { useState, useEffect } from "react";
import {
  PersonSimpleRunIcon as PersonSimpleRun,
  MapTrifoldIcon as MapTrifold,
  XIcon as X,
  PencilSimpleIcon as Pencil,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { Boot } from "@phosphor-icons/react/dist/csr/Boot";
import Toast from "./Toast";
import { api, OfflineError, type RunEntryResponse } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { ACTIVITY_COLORS } from "../activity";
import { todayKey } from "../dateKey";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [entries, setEntries] = useState<RunEntryResponse[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [runDuration, setRunDuration] = useState(1800);
  const [runCustomDuration, setRunCustomDuration] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [runDistance, setRunDistance] = useState("");
  const [runDate, setRunDate] = useState(todayKey);
  const [runNotes, setRunNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());

  const isRun = runType === "run";
  const Icon = isRun ? PersonSimpleRun : Boot;
  const label = isRun ? "Run" : "Walk";
  const logLabel = `Log a ${label}`;
  const saveLabel = `Save ${label}`;
  const plural = isRun ? "Runs" : "Walks";

  const myEntries = entries.filter((e) => e.run_type === runType);

  async function loadEntries() {
    try {
      const data = await api.getRuns();
      setEntries(data);
    } catch {
      /* silent — entries are cosmetic */
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function resetForm() {
    setRunDuration(1800);
    setRunCustomDuration("");
    setIsCustomDuration(false);
    setRunDistance("");
    setRunNotes("");
    setRunDate(todayKey());
    setNotePrompt(randomNotePrompt());
    setEditingId(null);
  }

  function startEdit(entry: RunEntryResponse) {
    setEditingId(entry.id);
    const preset = DURATION_OPTIONS.find((o) => o.seconds === entry.duration_seconds);
    if (preset) {
      setRunDuration(entry.duration_seconds);
      setIsCustomDuration(false);
      setRunCustomDuration("");
    } else {
      setRunDuration(entry.duration_seconds);
      setIsCustomDuration(true);
      setRunCustomDuration(String(Math.round(entry.duration_seconds / 60)));
    }
    setRunDistance(String(entry.distance_km));
    setRunDate(entry.date);
    setRunNotes(entry.notes);
    setShowForm(true);
  }

  async function handleSubmit() {
    const dist = parseFloat(runDistance);
    const dur = runDuration;
    if (isNaN(dist) || dist <= 0 || dur <= 0) return;

    try {
      const data = {
        duration_seconds: dur,
        distance_km: dist,
        run_type: runType,
        date: runDate,
        notes: runNotes,
      };
      if (editingId) {
        await api.updateRun(editingId, data);
        setToast(`${label} updated!`);
      } else {
        await api.createRun(data);
        setToast(`${label} logged!`);
      }
      resetForm();
      setShowForm(false);
      await loadEntries();
      onRunLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast(`${label} queued for sync`);
      } else {
        setToast(`Failed to save ${label.toLowerCase()}`);
      }
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteRun(id);
      setShowConfirmDelete(null);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setToast(`${label} deleted`);
    } catch (e) {
      setShowConfirmDelete(null);
      if (e instanceof OfflineError) {
        setToast(`${label} delete queued for sync`);
      } else {
        setToast(`Failed to delete ${label.toLowerCase()}`);
      }
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
          className="order-1 bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
          style={{ borderColor: ACTIVITY_COLORS[runType] }}
        >
          <Icon size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS[runType] }} />
          <p className="text-xs font-semibold text-fg">{label}</p>
        </button>

        {myEntries.length > 0 && (
          <div className="col-span-4 order-2 bg-surface rounded-xl p-3 border border-fg/10">
            <p className="text-xs font-semibold text-fg/50 mb-2">Recent {plural}</p>
            {myEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-fg/5 last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className="text-accent shrink-0" />
                  <div className="truncate">
                    <span className="text-sm text-fg font-medium">{entry.distance_km.toFixed(1)} km</span>
                    <span className="text-xs text-fg/30 ml-2">{formatDuration(entry.duration_seconds)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => startEdit(entry)}
                    aria-label={`Edit ${label.toLowerCase()}`}
                    className="p-1.5 text-fg/40 hover:text-fg rounded-lg hover:bg-bg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(entry.id)}
                    aria-label={`Delete ${label.toLowerCase()}`}
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
              <p className="text-sm font-semibold text-fg mb-2">Delete {label.toLowerCase()}?</p>
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
          <Icon size={18} weight="fill" />
          {toast}
        </Toast>
      )}

      {/* Collapsed button (always visible in grid) */}
      <button
        onClick={() => {
          resetForm();
          setShowForm(true);
        }}
        className="order-1 bg-surface rounded-xl p-3 border-2 hover:border-accent/40 transition-colors flex flex-col items-center gap-1.5"
        style={{ borderColor: ACTIVITY_COLORS[runType] }}
      >
        <Icon size={22} className="shrink-0" style={{ color: ACTIVITY_COLORS[runType] }} />
        <p className="text-xs font-semibold text-fg">{label}</p>
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
                  <Icon size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-fg">
                    {editingId ? `Edit ${label}` : logLabel}
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
        <div>
          <p className="text-xs text-fg/50 mb-1">Date</p>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="w-full max-w-full min-w-0 box-border bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
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
            placeholder={notePrompt}
            aria-label="Notes"
            className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!runDistance || parseFloat(runDistance) <= 0}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {editingId ? `Update ${label}` : saveLabel}
        </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
