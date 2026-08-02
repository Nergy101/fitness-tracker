import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  BandaidsIcon as Bandaids,
  PlusCircleIcon as PlusCircle,
  XIcon as X,
  CaretUpIcon as CaretUp,
  CaretDownIcon as CaretDown,
} from "@phosphor-icons/react";
import { api, OfflineError, type InjuryMarkerResponse, type InjuryMarkerCreate } from "../../api";

export default function InjurySection() {
  const [injuries, setInjuries] = useState<InjuryMarkerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [bodyPart, setBodyPart] = useState("");
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const loadInjuries = useCallback(async () => {
    try {
      const data = await api.getInjuries();
      setInjuries(data);
    } catch (e) {
      if (e instanceof OfflineError) {
        flashToast("You're offline — injury data may be stale");
      } else {
        flashToast("Failed to load injuries");
      }
    } finally {
      setLoading(false);
    }
  }, [flashToast]);

  useEffect(() => {
    loadInjuries();
  }, [loadInjuries]);

  const activeCount = useMemo(() => injuries.filter((i) => !i.resolved_date).length, [injuries]);

  const submitInjury = async () => {
    if (!bodyPart.trim()) return;
    const data: InjuryMarkerCreate = {
      body_part: bodyPart.trim(),
      severity,
      notes: notes.trim() || undefined,
    };
    try {
      const created = await api.createInjury(data);
      setInjuries((prev) => [created, ...prev]);
      setBodyPart("");
      setSeverity(3);
      setNotes("");
      setShowForm(false);
      flashToast("Injury logged");
    } catch (e) {
      if (e instanceof OfflineError) {
        flashToast("Injury queued for sync");
      } else {
        flashToast("Failed to log injury");
      }
    }
  };

  const resolveInjury = async (id: number) => {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const updated = await api.updateInjury(id, { resolved_date: today });
      setInjuries((prev) => prev.map((i) => (i.id === id ? updated : i)));
      flashToast("Injury marked as healed");
    } catch (e) {
      if (e instanceof OfflineError) {
        flashToast("Heal queued for sync");
      } else {
        flashToast("Failed to update injury");
      }
    }
  };

  const deleteInjury = async (id: number) => {
    try {
      await api.deleteInjury(id);
      setInjuries((prev) => prev.filter((i) => i.id !== id));
      flashToast("Injury deleted");
    } catch (e) {
      if (e instanceof OfflineError) {
        flashToast("Delete queued for sync");
      } else {
        flashToast("Failed to delete injury");
      }
    }
  };

  const active = injuries.filter((i) => !i.resolved_date);
  const resolved = injuries.filter((i) => i.resolved_date);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl p-4 border border-fg/5">
        <div className="skeleton-shimmer h-5 w-32 rounded" />
        <div className="skeleton-shimmer h-4 w-48 rounded mt-2" />
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      {/* Toast notification */}
      {toast && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent text-center">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bandaids size={20} className="text-red-400" />
          <span className="text-sm font-semibold text-fg">Injury Timeline</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-400/15 text-red-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium transition-colors"
          aria-label="Log injury"
        >
          <PlusCircle size={14} />
          Log
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 p-3 rounded-lg bg-fg/[0.03] border border-fg/10 space-y-3">
          <div>
            <label className="text-[11px] text-fg/50 mb-1 block">Body Part</label>
            <input
              type="text"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              placeholder="e.g. left knee, right ankle, lower back"
              className="w-full rounded-lg bg-surface border border-fg/10 px-3 py-2 text-sm text-fg placeholder:text-fg/25 focus:outline-none focus:border-accent"
              aria-label="Injury body part"
            />
          </div>
          <div>
            <label className="text-[11px] text-fg/50 mb-1 block">
              Severity:{" "}
              <span className={severity >= 4 ? "text-red-400" : severity >= 2 ? "text-amber-400" : "text-fg/50"}>
                {severity === 1 ? "Niggling" : severity === 2 ? "Mild" : severity === 3 ? "Moderate" : severity === 4 ? "Painful" : "Can't train"}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="w-full accent-red-400 touch-none"
              aria-label="Injury severity"
            />
            <div className="flex justify-between text-[10px] text-fg/30 mt-0.5">
              <span>1</span>
              <span>3</span>
              <span>5</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-fg/50 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How it happened..."
              className="w-full rounded-lg bg-surface border border-fg/10 px-3 py-2 text-sm text-fg placeholder:text-fg/25 focus:outline-none focus:border-accent"
              aria-label="Injury notes"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitInjury}
              disabled={!bodyPart.trim()}
              className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-on-accent py-2 text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Log Injury
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 rounded-lg bg-fg/5 hover:bg-fg/10 text-fg/50 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active injuries */}
      {active.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {active.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between py-1.5 px-2 rounded-md bg-red-400/5 border border-red-400/15"
              style={{ opacity: 0.5 + i.severity * 0.1 }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-sm text-fg font-medium truncate">{i.body_part}</span>
                <span className="text-[11px] text-fg/30">
                  {i.severity}/5
                </span>
                <span className="text-[11px] text-fg/25">
                  {i.date}
                </span>
                {i.notes && (
                  <span className="text-[11px] text-fg/30 truncate hidden sm:inline">— {i.notes}</span>
                )}
              </div>
              <button
                onClick={() => resolveInjury(i.id)}
                className="text-[11px] text-fg/30 hover:text-green-400 shrink-0 ml-2 transition-colors"
              >
                heal
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Resolved toggle */}
      {resolved.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-fg/30 hover:text-fg/50 transition-colors"
          >
            {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            {resolved.length} healed {resolved.length === 1 ? "injury" : "injuries"}
          </button>
          {expanded && (
            <div className="space-y-1 mt-2">
              {resolved.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between py-1 px-2 rounded text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 text-fg/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-fg/15 shrink-0" />
                    <span className="truncate">{i.body_part}</span>
                    <span>
                      {i.date} → {i.resolved_date}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteInjury(i.id)}
                    className="text-fg/15 hover:text-red-400 shrink-0 ml-2 transition-colors"
                    aria-label="Delete injury"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {injuries.length === 0 && (
        <p className="text-xs text-fg/30 mt-1">
          No injuries logged. Tap "Log" to mark a sore knee, sprained ankle, or any small injury — they'll appear as red markers on your charts.
        </p>
      )}
    </div>
  );
}
