import { useState, useEffect } from "react";
import {
  BicycleIcon as Bicycle,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
  XIcon as X,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, OfflineError, type CyclingEntryResponse } from "../api";
import { formatDuration, formatDate } from "../format";
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [entries, setEntries] = useState<CyclingEntryResponse[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);

  async function loadEntries() {
    try {
      const data = await api.getCycling();
      setEntries(data);
    } catch { /* silent */ }
  }

  useEffect(() => { loadEntries(); }, []);

  function resetForm() {
    setDuration(1800);
    setCustomDuration("");
    setIsCustomDuration(false);
    setDistanceKm("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotePrompt(randomNotePrompt());
    setEditingId(null);
  }

  function startEdit(entry: CyclingEntryResponse) {
    setEditingId(entry.id);
    const mins = entry.duration_seconds;
    const isPreset = DURATION_OPTIONS.some(o => o.seconds > 0 && o.seconds === mins);
    setDuration(mins);
    setIsCustomDuration(!isPreset);
    if (!isPreset) {
      setCustomDuration(String(Math.round(mins / 60)));
    } else {
      setCustomDuration("");
    }
    setDistanceKm(String(entry.distance_km));
    setDate(entry.date);
    setNotes(entry.notes);
    setShowForm(true);
  }

  async function handleSubmit() {
    const dist = parseFloat(distanceKm);
    const dur = duration;
    if (isNaN(dist) || dist <= 0 || dur <= 0) return;

    try {
      if (editingId) {
        await api.updateCycling(editingId, {
          duration_seconds: dur,
          distance_km: dist,
          date,
          notes,
        });
        setToast("Cycling ride updated!");
      } else {
        await api.createCycling({
          duration_seconds: dur,
          distance_km: dist,
          date,
          notes,
        });
        setToast("Cycling ride logged!");
      }
      resetForm();
      setShowForm(false);
      await loadEntries();
      onWorkoutLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast(editingId ? "Update queued for sync" : "Cycling ride queued for sync");
      } else {
        setToast(editingId ? "Failed to update cycling ride" : "Failed to log cycling ride");
      }
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteCycling(id);
      setToast("Cycling ride deleted");
      setShowConfirmDelete(null);
      await loadEntries();
      onWorkoutLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast("Delete queued for sync");
      } else {
        setToast("Failed to delete cycling ride");
      }
      setShowConfirmDelete(null);
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

        {/* Recent rides */}
        {entries.length > 0 && (
          <div className="mt-3 bg-surface rounded-xl p-3 border border-fg/5">
            <p className="text-xs text-fg/40 font-medium mb-2">Recent Rides</p>
            {entries.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-fg/5 last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Bicycle size={14} style={{ color: ACTIVITY_COLORS.cycling }} className="shrink-0" />
                  <div className="truncate">
                    <span className="text-sm text-fg font-medium">{entry.distance_km.toFixed(1)} km</span>
                    <span className="text-xs text-fg/30 ml-2">{formatDate(entry.date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => startEdit(entry)} aria-label="Edit" className="p-1.5 text-fg/40 hover:text-fg rounded-lg hover:bg-bg transition-colors">
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => setShowConfirmDelete(entry.id)} aria-label="Delete" className="p-1.5 text-fg/40 hover:text-red-400 rounded-lg hover:bg-bg transition-colors">
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirmation overlay */}
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
              <p className="text-sm font-semibold text-fg mb-2">Delete ride?</p>
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

      {/* Delete confirmation overlay */}
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
            <p className="text-sm font-semibold text-fg mb-2">Delete ride?</p>
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
                  <span className="text-sm font-semibold text-fg">
                    {editingId ? "Edit Cycling Ride" : "Log a Cycling Ride"}
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
                {editingId ? "Update Cycling Ride" : "Save Cycling Ride"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
