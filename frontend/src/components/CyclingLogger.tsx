import { useState, useEffect } from "react";
import { BicycleIcon as Bicycle } from "@phosphor-icons/react";
import { LoggerSheet, LoggerToast, NumberControl, QuickPicks, DateQuickPicks, SheetField, useWeightForDate, cyclingKcal } from "./LoggerSheet";
import { api, OfflineError, type CyclingEntryResponse } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { todayKey } from "../dateKey";

interface CyclingLoggerProps {
  onWorkoutLogged: () => void;
  editEntry?: CyclingEntryResponse | null;
  onEditHandled?: () => void;
  hideTrigger?: boolean;
  openRequest?: { key: number; durationSeconds?: number; distanceKm?: number } | null;
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

export default function CyclingLogger({ onWorkoutLogged, editEntry, onEditHandled, openRequest, hideTrigger = false }: CyclingLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [distanceKm, setDistanceKm] = useState("");
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());

  function resetForm() {
    setDuration(1800);
    setCustomDuration("");
    setIsCustomDuration(false);
    setDistanceKm("");
    setNotes("");
    setDate(todayKey());
    setNotePrompt(randomNotePrompt());
    setEditingId(null);
  }

  function startEdit(entry: CyclingEntryResponse) {
    setEditingId(entry.id);
    const preset = DURATION_OPTIONS.find((option) => option.seconds === entry.duration_seconds);
    if (preset) {
      setDuration(entry.duration_seconds);
      setIsCustomDuration(false);
      setCustomDuration("");
    } else {
      setDuration(entry.duration_seconds);
      setIsCustomDuration(true);
      setCustomDuration(String(Math.round(entry.duration_seconds / 60)));
    }
    setDistanceKm(String(entry.distance_km));
    setDate(entry.date);
    setNotes(entry.notes);
    setShowForm(true);
  }

  useEffect(() => {
    if (editEntry) {
      startEdit(editEntry);
      onEditHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntry]);
  useEffect(() => {
    if (!openRequest) return;
    resetForm();
    if (openRequest.durationSeconds != null) {
      const requestDuration = openRequest.durationSeconds;
      setDuration(requestDuration);
      const isPreset = DURATION_OPTIONS.some((option) => option.seconds === requestDuration);
      setIsCustomDuration(!isPreset);
      setCustomDuration(isPreset ? "" : String(Math.round(requestDuration / 60)));
    }
    if (openRequest.distanceKm != null) setDistanceKm(String(openRequest.distanceKm));
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.key]);


  async function handleSubmit() {
    const distance = parseFloat(distanceKm);
    const rideDuration = duration;
    if (isNaN(distance) || distance <= 0 || rideDuration <= 0) return;

    try {
      const data = { duration_seconds: rideDuration, distance_km: distance, date, notes };
      if (editingId) {
        await api.updateCycling(editingId, data);
        setToast("Cycling ride updated!");
      } else {
        await api.createCycling(data);
        setToast("Cycling ride logged!");
      }
      resetForm();
      setShowForm(false);
      onWorkoutLogged();
    } catch (error) {
      if (error instanceof OfflineError) {
        setToast("Cycling ride queued for sync");
      } else {
        setToast("Failed to save cycling ride");
      }
    }
  }

  const distance = parseFloat(distanceKm);
  const weightKg = useWeightForDate(date, showForm);
  const averageSpeed = distance > 0 && duration > 0 ? distance / (duration / 3600) : 0;
  const energy = distance > 0 && duration > 0 ? cyclingKcal(distance, duration, weightKg) : 0;
  const effort = averageSpeed < 15 ? "Easy" : averageSpeed < 21 ? "Moderate" : averageSpeed < 28 ? "Fast" : "Racing";
  const intensityIndex = effort === "Easy" ? 0 : effort === "Moderate" ? 1 : effort === "Fast" ? 2 : 3;

  return (
    <>
      {!hideTrigger && <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-tint-cycling-bg px-4 text-sm font-bold text-tint-cycling-fg"><Bicycle size={20}/><span>Cycling</span></button>}
      {toast && <LoggerToast onDismiss={() => setToast(null)}><Bicycle size={18} weight="fill" />{toast}</LoggerToast>}
      {showForm && (
        <LoggerSheet
          title={editingId ? "Edit Cycling Ride" : "Log a Cycling Ride"}
          activity="cycling"
          icon={<Bicycle size={22} />}
          onClose={() => { resetForm(); setShowForm(false); }}
          onSubmit={handleSubmit}
          submitDisabled={!distanceKm || distance <= 0 || duration <= 0}
          submitLabel={editingId ? "Update Cycling Ride" : "Save Cycling Ride"}
        >
          <SheetField label="Distance">
            <NumberControl
              label="Distance in km"
              unit="km"
              value={distanceKm}
              inputMode="decimal"
placeholder="24.0"
              onChange={setDistanceKm}
              onDecrease={() => setDistanceKm(String(Math.max(0, (parseFloat(distanceKm) || 0) - 1)))}
              onIncrease={() => setDistanceKm(String((parseFloat(distanceKm) || 0) + 1))}
            />
            <QuickPicks
              label="Quick distance"
              options={[10, 20, 30, 50].map((value) => ({ label: `${value} km`, value: String(value) }))}
              selected={distanceKm}
              activity="cycling"
              onSelect={setDistanceKm}
            />
          </SheetField>

          <SheetField label="Duration">
            <NumberControl
              label="Duration in minutes"
              unit="min"
              value={customDuration || (duration > 0 ? String(Math.round(duration / 60)) : "")}
              inputMode="numeric"
              onChange={(value) => { setCustomDuration(value); setDuration((parseInt(value, 10) || 0) * 60); setIsCustomDuration(true); }}
              onDecrease={() => { setIsCustomDuration(true); setCustomDuration(String(Math.max(0, Math.round(duration / 60) - 5))); setDuration(Math.max(0, duration - 300)); }}
              onIncrease={() => { setIsCustomDuration(true); setCustomDuration(String(Math.round(duration / 60) + 5)); setDuration(duration + 300); }}
            />
            <QuickPicks
              label="Quick duration"
              options={DURATION_OPTIONS.slice(0, 4).map((option) => ({ label: option.label, value: String(option.seconds) }))}
              selected={!isCustomDuration ? String(duration) : ""}
              activity="cycling"
              onSelect={(value) => { setIsCustomDuration(false); setDuration(Number(value)); setCustomDuration(""); }}
            />
            <button type="button" onClick={() => { setIsCustomDuration(true); setDuration(0); setCustomDuration(""); }} aria-pressed={isCustomDuration} className={`min-h-10 rounded-full border px-4 text-sm font-bold ${isCustomDuration ? "bg-[var(--tint-cycling-bg)] text-[var(--tint-cycling-fg)]" : "border-track text-fg"}`}>Custom</button>
            {isCustomDuration && <input type="number" inputMode="numeric" value={customDuration} onChange={(event) => { setCustomDuration(event.target.value); setDuration((parseInt(event.target.value, 10) || 0) * 60); }} placeholder="Minutes" aria-label="Custom duration in minutes" className="min-h-12 w-full rounded-2xl bg-field px-4 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent" />}
          </SheetField>

          {distance > 0 && duration > 0 && (
            <div className="space-y-3 rounded-2xl bg-[var(--tint-cycling-bg)] p-3 text-[var(--tint-cycling-fg)]" aria-live="polite">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="block text-[11px] font-semibold opacity-75">Avg speed</span><span className="text-base font-extrabold tabular-nums">{averageSpeed.toFixed(1)} km/h</span></div>
                <div><span className="block text-[11px] font-semibold opacity-75">Effort</span><span className="text-base font-extrabold">{effort}</span></div>
                <div><span className="block text-[11px] font-semibold opacity-75">Active energy</span><span className="text-base font-extrabold tabular-nums">~{energy} kcal</span></div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-current/15 pt-2 text-xs font-semibold">
                <span className="tabular-nums">{distance.toFixed(1)} km</span>
                <span>{formatDuration(duration)}</span>
              </div>
              <div aria-label={`Intensity: ${effort}`}>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((index) => <span key={index} className={`h-1.5 rounded-full ${index <= intensityIndex ? "bg-[var(--tint-cycling-fg)]" : "bg-surface"}`} />)}
                </div>
                <div className="mt-1 grid grid-cols-4 text-[10px] font-semibold opacity-75"><span>Easy</span><span>Moderate</span><span>Fast</span><span>Racing</span></div>
              </div>
            </div>
          )}

          <DateQuickPicks value={date} onChange={setDate} />
          <SheetField label="Notes (optional)">
            <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={notePrompt} aria-label="Notes" className="min-h-[52px] w-full rounded-2xl bg-field px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
          </SheetField>
        </LoggerSheet>
      )}
    </>
  );
}
