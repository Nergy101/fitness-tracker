import { useState, useEffect } from "react";
import { PersonSimpleRunIcon as PersonSimpleRun } from "@phosphor-icons/react";
import { LoggerSheet, LoggerToast, NumberControl, QuickPicks, DateQuickPicks, SheetField, useWeightForDate, runKcal } from "./LoggerSheet";
import { Boot } from "@phosphor-icons/react/dist/csr/Boot";
import { api, OfflineError, type RunEntryResponse } from "../api";
import { randomNotePrompt } from "../notePrompts";
import { todayKey } from "../dateKey";

interface RunLoggerProps {
  onRunLogged: () => void;
  runType: "run" | "walk";
  /** Set by the Recent-workouts tag row to open this entry in the edit form. */
  editEntry?: RunEntryResponse | null;
  /** Called once `editEntry` has been consumed, so the parent can clear it. */
  onEditHandled?: () => void;
  openRequest?: { key: number; runType: "run" | "walk"; durationSeconds?: number; distanceKm?: number } | null;
  hideTrigger?: boolean;
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

export default function RunLogger({ onRunLogged, runType, editEntry, onEditHandled, openRequest, hideTrigger = false }: RunLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  // A Recent-workouts tag asked for this entry: open its form. Declared after
  // startEdit so the hook reads it as an already-initialised binding.
  useEffect(() => {
    if (editEntry && editEntry.run_type === runType) {
      startEdit(editEntry);
      onEditHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntry]);

  useEffect(() => {
    if (!openRequest || openRequest.runType !== runType) return;
    resetForm();
    if (openRequest.durationSeconds != null) {
      const requestDuration = openRequest.durationSeconds;
      setRunDuration(requestDuration);
      const isPreset = DURATION_OPTIONS.some((option) => option.seconds === requestDuration);
      setIsCustomDuration(!isPreset);
      setRunCustomDuration(isPreset ? "" : String(Math.round(requestDuration / 60)));
    }
    if (openRequest.distanceKm != null) setRunDistance(String(openRequest.distanceKm));
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.key]);

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
      onRunLogged();
    } catch (e) {
      if (e instanceof OfflineError) {
        setToast(`${label} queued for sync`);
      } else {
        setToast(`Failed to save ${label.toLowerCase()}`);
      }
    }
  }

  const distance = parseFloat(runDistance);
  const pace = runDuration > 0 && distance > 0 ? runDuration / distance : null;
  const weightKg = useWeightForDate(runDate, showForm);
  const estimatedKcal = distance > 0 ? runKcal(distance, runType, weightKg) : null;
  const speedKmh = runDuration > 0 && distance > 0 ? distance / (runDuration / 3600) : null;
  // ── Form as bottom sheet ──
  return (
    <>
      {!hideTrigger && <button type="button" onClick={() => { resetForm(); setShowForm(true); }} aria-label={logLabel} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ${runType === "run" ? "bg-tint-run-bg text-tint-run-fg" : "bg-tint-walk-bg text-tint-walk-fg"}`}><Icon size={20} />{label}</button>}
      {toast && (
        <LoggerToast onDismiss={() => setToast(null)}>
          <Icon size={18} weight="fill" />
          {toast}
        </LoggerToast>
      )}



      {showForm && (
        <LoggerSheet
          title={editingId ? `Edit ${label}` : logLabel}
          activity={runType}
          icon={<Icon size={22} />}
          onClose={() => { resetForm(); setShowForm(false); }}
          onSubmit={handleSubmit}
          submitDisabled={!runDistance || distance <= 0 || runDuration <= 0}
          submitLabel={editingId ? `Update ${label}` : saveLabel}
        >
          <div role="group" aria-label="Activity type" className="grid grid-cols-2 gap-1 rounded-full bg-field p-1">
            {(["run", "walk"] as const).map((type) => (
              <span key={type} aria-current={runType === type ? "true" : undefined} className={`flex min-h-10 items-center justify-center rounded-full text-sm font-extrabold capitalize ${runType === type ? (type === "run" ? "bg-[var(--tint-run-bg)] text-[var(--tint-run-fg)]" : "bg-[var(--tint-walk-bg)] text-[var(--tint-walk-fg)]") : "text-muted"}`}>
                {type}
              </span>
            ))}
          </div>
          <SheetField label="Distance">
            <NumberControl
              label="Distance in km"
              unit="km"
              value={runDistance}
              inputMode="decimal"
placeholder="5.0"
              onChange={setRunDistance}
              onDecrease={() => setRunDistance(String(Math.max(0, (parseFloat(runDistance) || 0) - 0.5)))}
              onIncrease={() => setRunDistance(String((parseFloat(runDistance) || 0) + 0.5))}
            />
            <QuickPicks
              label="Quick distance"
              options={["3", "5", "10", "21.1"].map((value) => ({ label: `${value} km`, value }))}
              selected={runDistance}
              activity={runType}
              onSelect={setRunDistance}
            />
          </SheetField>

          <SheetField label="Duration">
            <NumberControl
              label="Duration in minutes"
              unit="min"
              value={runCustomDuration || (runDuration > 0 ? String(Math.round(runDuration / 60)) : "")}
              inputMode="numeric"
              onChange={(value) => {
                setRunCustomDuration(value);
                setRunDuration((parseInt(value, 10) || 0) * 60);
                setIsCustomDuration(true);
              }}
              onDecrease={() => { setIsCustomDuration(true); setRunCustomDuration(String(Math.max(0, Math.round(runDuration / 60) - 5))); setRunDuration(Math.max(0, runDuration - 300)); }}
              onIncrease={() => { setIsCustomDuration(true); setRunCustomDuration(String(Math.round(runDuration / 60) + 5)); setRunDuration(runDuration + 300); }}
            />
            <QuickPicks
              label="Quick duration"
              options={DURATION_OPTIONS.slice(0, 4).map((option) => ({ label: option.label, value: String(option.seconds) }))}
              selected={!isCustomDuration ? String(runDuration) : ""}
              activity={runType}
              onSelect={(value) => { setIsCustomDuration(false); setRunDuration(Number(value)); setRunCustomDuration(""); }}
            />
            <button
              type="button"
              onClick={() => { setIsCustomDuration(true); setRunDuration(0); setRunCustomDuration(""); }}
              aria-pressed={isCustomDuration}
              className={`min-h-10 rounded-full border px-4 text-sm font-bold ${isCustomDuration ? `bg-[var(--tint-${runType}-bg)] text-[var(--tint-${runType}-fg)]` : "border-track text-fg"}`}
            >
              Custom
            </button>
            {isCustomDuration && (
              <input
                type="number"
                inputMode="numeric"
                value={runCustomDuration}
                onChange={(event) => { setRunCustomDuration(event.target.value); setRunDuration((parseInt(event.target.value, 10) || 0) * 60); }}
                placeholder="Minutes"
                aria-label="Custom duration in minutes"
                className="min-h-12 w-full rounded-2xl bg-field px-4 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            )}
          </SheetField>

          {pace && pace > 0 && (
            <div className={`grid grid-cols-3 gap-2 rounded-2xl p-3 ${runType === "run" ? "bg-[var(--tint-run-bg)] text-[var(--tint-run-fg)]" : "bg-[var(--tint-walk-bg)] text-[var(--tint-walk-fg)]"}`} aria-live="polite">
              <div><span className="block text-[11px] font-semibold opacity-75">Pace</span><span className="text-base font-extrabold tabular-nums">{formatPace(pace)}</span></div>
              <div><span className="block text-[11px] font-semibold opacity-75">Speed</span><span className="text-base font-extrabold tabular-nums">{speedKmh?.toFixed(1)} km/h</span></div>
              <div><span className="block text-[11px] font-semibold opacity-75">Active energy</span><span className="text-base font-extrabold tabular-nums">~{estimatedKcal} kcal</span></div>
            </div>
          )}

          <DateQuickPicks value={runDate} onChange={setRunDate} />
          <SheetField label="Notes (optional)">
            <input
              type="text"
              value={runNotes}
              onChange={(event) => setRunNotes(event.target.value)}
              placeholder={notePrompt}
              aria-label="Notes"
              className="min-h-[52px] w-full rounded-2xl bg-field px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </SheetField>
        </LoggerSheet>
      )}
    </>
  );
}
