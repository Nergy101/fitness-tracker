import { useState, useEffect } from "react";
import { HandFistIcon as HandFist } from "@phosphor-icons/react";
import { LoggerSheet, LoggerToast, NumberControl, QuickPicks, DateQuickPicks, SheetField } from "./LoggerSheet";
import { api, OfflineError, type BoxingEntryResponse } from "../api";
import { formatDuration } from "../format";
import { randomNotePrompt } from "../notePrompts";
import { todayKey } from "../dateKey";

interface BoxingLoggerProps {
  onWorkoutLogged: () => void;
  editEntry?: BoxingEntryResponse | null;
  onEditHandled?: () => void;
  openRequest?: { key: number; durationSeconds?: number; rounds?: number } | null;
  hideTrigger?: boolean;
}

const DURATION_OPTIONS = [
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "45m", seconds: 2700 },
  { label: "1h", seconds: 3600 },
  { label: "Custom", seconds: 0 },
];

const DEFAULT_KCAL_PER_MIN = 10;

function calcKcal(durationSeconds: number, kcalPerMin: number): number {
  return Math.round((durationSeconds / 60) * kcalPerMin);
}

export default function BoxingLogger({ onWorkoutLogged, editEntry, onEditHandled, openRequest, hideTrigger = false }: BoxingLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [duration, setDuration] = useState(1800);
  const [customDuration, setCustomDuration] = useState("");
  const [kcalPerMin, setKcalPerMin] = useState(DEFAULT_KCAL_PER_MIN);
  const [rounds, setRounds] = useState<number | null>(null);
  const [date, setDate] = useState(todayKey);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [notePrompt, setNotePrompt] = useState(() => randomNotePrompt());

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
    const preset = DURATION_OPTIONS.find((option) => option.seconds === entry.duration_seconds);
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
      setCustomDuration(isPreset ? "" : String(Math.round(requestDuration / 60)));
    }
    if (openRequest.rounds != null) setRounds(openRequest.rounds);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.key]);


  async function handleSubmit() {
    if (duration <= 0) return;

    try {
      const data = {
        duration_seconds: duration,
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
      onWorkoutLogged();
    } catch (error) {
      if (error instanceof OfflineError) {
        setToast("Boxing workout queued for sync");
      } else {
        setToast("Failed to save boxing workout");
      }
    }
  }

  const estimatedKcal = calcKcal(duration, kcalPerMin);
  const selectedIntensity = kcalPerMin <= 7 ? "Technique" : kcalPerMin <= 11 ? "Bag work" : "Sparring";

  return (
    <>
      {!hideTrigger && <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-tint-boxing-bg px-4 text-sm font-bold text-tint-boxing-fg"><HandFist size={20}/><span>Boxing</span></button>}
      {toast && <LoggerToast onDismiss={() => setToast(null)}><HandFist size={18} weight="fill" />{toast}</LoggerToast>}
      {showForm && (
        <LoggerSheet
          title={editingId ? "Edit Boxing Session" : "Log Boxing"}
          activity="boxing"
          icon={<HandFist size={22} />}
          onClose={() => { resetForm(); setShowForm(false); }}
          onSubmit={handleSubmit}
          submitDisabled={duration <= 0}
          submitLabel={editingId ? "Update Boxing Session" : "Save Boxing Workout"}
        >
          <SheetField label="Duration">
            <NumberControl
              label="Duration in minutes"
              unit="min"
              value={customDuration || (duration > 0 ? String(Math.round(duration / 60)) : "")}
              inputMode="numeric"
              onChange={(value) => { setCustomDuration(value); setDuration((parseInt(value, 10) || 0) * 60); }}
              onDecrease={() => { setCustomDuration(String(Math.max(0, Math.round(duration / 60) - 5))); setDuration(Math.max(0, duration - 300)); }}
              onIncrease={() => { setCustomDuration(String(Math.round(duration / 60) + 5)); setDuration(duration + 300); }}
            />
            <QuickPicks
              label="Quick duration"
              options={DURATION_OPTIONS.slice(0, 4).map((option) => ({ label: option.label, value: String(option.seconds) }))}
              selected={customDuration ? "" : String(duration)}
              activity="boxing"
              onSelect={(value) => { setDuration(Number(value)); setCustomDuration(""); }}
            />
            <button type="button" onClick={() => { setDuration(0); setCustomDuration(""); }} aria-pressed={duration === 0} className={`min-h-10 rounded-full border px-4 text-sm font-bold ${duration === 0 ? "bg-[var(--tint-boxing-bg)] text-[var(--tint-boxing-fg)]" : "border-track text-fg"}`}>Custom</button>
            {duration === 0 && <input type="number" inputMode="numeric" value={customDuration} onChange={(event) => { setCustomDuration(event.target.value); setDuration((parseInt(event.target.value, 10) || 0) * 60); }} placeholder="Minutes" aria-label="Custom duration in minutes" className="min-h-12 w-full rounded-2xl bg-field px-4 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent" />}
          </SheetField>

          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Rounds (optional)">
              <NumberControl label="Rounds" value={rounds == null ? "" : String(rounds)} inputMode="numeric" onChange={(value) => setRounds(value ? parseInt(value, 10) || null : null)} onDecrease={() => setRounds(rounds == null || rounds <= 1 ? null : rounds - 1)} onIncrease={() => setRounds((rounds ?? 0) + 1)} placeholder="e.g. 10" />
            </SheetField>
            <SheetField label="Kcal per minute">
              <NumberControl
                label="Kcal per minute"
                value={String(kcalPerMin)}
                inputMode="decimal"
                onChange={(value) => setKcalPerMin(parseFloat(value) || 0)}
                onDecrease={() => setKcalPerMin(Math.max(0, Math.round((kcalPerMin - 1) * 10) / 10))}
                onIncrease={() => setKcalPerMin(Math.round((kcalPerMin + 1) * 10) / 10)}
              />
            </SheetField>
          </div>

          <SheetField label="Intensity">
            <div role="group" aria-label="Intensity preset" className="grid grid-cols-3 gap-1 rounded-3xl bg-field p-1">
              {[{ label: "Technique", rate: 6 }, { label: "Bag work", rate: 10 }, { label: "Sparring", rate: 14 }].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={selectedIntensity === preset.label}
                  onClick={() => setKcalPerMin(preset.rate)}
                  className={`min-h-10 rounded-2xl px-1 text-xs font-bold transition-colors sm:text-sm ${selectedIntensity === preset.label ? "bg-[var(--tint-boxing-bg)] text-[var(--tint-boxing-fg)]" : "text-muted hover:bg-surface"}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </SheetField>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--tint-boxing-bg)] p-3 text-[var(--tint-boxing-fg)]" aria-live="polite">
            <span><span className="block text-[11px] font-semibold opacity-75">Active energy</span><span className="text-xl font-extrabold tabular-nums">~{estimatedKcal} kcal</span></span>
            <span className="text-right text-xs font-bold">{duration > 0 ? formatDuration(duration) : "—"} × {kcalPerMin}</span>
          </div>

          <DateQuickPicks value={date} onChange={setDate} />
          <SheetField label="Notes (optional)">
            <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={notePrompt} aria-label="Notes" className="min-h-[52px] w-full rounded-2xl bg-field px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
          </SheetField>
        </LoggerSheet>
      )}
    </>
  );
}

