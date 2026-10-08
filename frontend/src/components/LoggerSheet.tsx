import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarBlankIcon as CalendarBlank, XIcon as X } from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, type WeightEntryResponse } from "../api";
import { dayKey, todayKey } from "../dateKey";

export type LoggerActivity = "run" | "walk" | "cycling" | "boxing";

const activityTintClass: Record<LoggerActivity, string> = {
  run: "bg-[var(--tint-run-bg)] text-[var(--tint-run-fg)]",
  walk: "bg-[var(--tint-walk-bg)] text-[var(--tint-walk-fg)]",
  cycling: "bg-[var(--tint-cycling-bg)] text-[var(--tint-cycling-fg)]",
  boxing: "bg-[var(--tint-boxing-bg)] text-[var(--tint-boxing-fg)]",
};

interface LoggerSheetProps {
  title: string;
  activity: LoggerActivity;
  icon: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  children: ReactNode;
}

export function LoggerSheet({
  title,
  activity,
  icon,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  children,
}: LoggerSheetProps) {
  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100dvh-3.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] bg-surface shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-2">
          <div className="mx-auto h-[5px] w-10 rounded-full bg-track" />
          <div className="flex items-center gap-3 py-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${activityTintClass[activity]}`}>
              {icon}
            </span>
            <h2 className="min-w-0 flex-1 text-2xl font-extrabold tracking-tight text-fg">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-field text-fg transition-colors hover:bg-fg/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
          {children}
        </div>
        <div className="shrink-0 border-t border-fg/5 bg-surface px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="h-14 w-full rounded-full bg-accent text-[17px] font-extrabold text-on-accent shadow-[var(--shadow-sm)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  ), document.body);
}

export function LoggerToast({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return createPortal(<Toast onDismiss={onDismiss}>{children}</Toast>, document.body);
}

interface NumberControlProps {
  label: string;
  unit?: string;
  value: string;
  inputMode: "decimal" | "numeric";
  onChange: (value: string) => void;
  onDecrease: () => void;
  onIncrease: () => void;
  placeholder?: string;
}

export function NumberControl({
  label,
  unit,
  value,
  inputMode,
  onChange,
  onDecrease,
  onIncrease,
  placeholder,
}: NumberControlProps) {
  return (
    <div className="flex h-[72px] items-center justify-between gap-2 rounded-3xl bg-field px-3">
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        onClick={onDecrease}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-2xl font-extrabold text-fg transition active:scale-95"
      >
        −
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5">
        <span className="sr-only">{label}</span>
        <input
          type="text"
          inputMode={inputMode}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-[5ch] min-w-0 max-w-[55%] bg-transparent p-0 text-right text-[clamp(2.35rem,10vw,3rem)] font-extrabold leading-none tracking-tight text-fg outline-none placeholder:text-muted"
        />
        {unit && <span className="shrink-0 text-base font-bold text-muted">{unit}</span>}
      </label>
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        onClick={onIncrease}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-2xl font-extrabold text-fg transition active:scale-95"
      >
        +
      </button>
    </div>
  );
}

interface QuickPicksProps {
  label: string;
  options: readonly { label: string; value: string }[];
  selected: string;
  activity: LoggerActivity;
  onSelect: (value: string) => void;
}

export function QuickPicks({ label, options, selected, activity, onSelect }: QuickPicksProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-muted">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={`min-h-10 rounded-full border px-1 text-xs font-bold transition-colors sm:text-sm ${
                active
                  ? `${activityTintClass[activity]} border-transparent`
                  : "border-track bg-transparent text-fg hover:bg-field"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DateQuickPicksProps {
  value: string;
  onChange: (date: string) => void;
}

export function DateQuickPicks({ value, onChange }: DateQuickPicksProps) {
  const today = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayValue = dayKey(yesterday);
  const quickDates = [
    { label: "Today", date: today },
    { label: "Yesterday", date: yesterdayValue },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-bold text-muted">Date</span>
      {quickDates.map((quick) => (
        <button
          key={quick.label}
          type="button"
          aria-pressed={value === quick.date}
          onClick={() => onChange(quick.date)}
          className={`min-h-10 rounded-full px-3.5 text-sm font-bold transition-colors ${
            value === quick.date ? "bg-inverse text-on-inverse" : "bg-field text-fg hover:bg-fg/10"
          }`}
        >
          {quick.label}
        </button>
      ))}
      <label className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-field text-fg hover:bg-fg/10" aria-label="Pick a date">
        <CalendarBlank size={18} aria-hidden="true" />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Pick a date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function SheetField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted">{label}</p>
      {children}
    </div>
  );
}

export function useWeightForDate(date: string, enabled: boolean): number {
  const [entries, setEntries] = useState<WeightEntryResponse[]>([]);

  useEffect(() => {
    if (!enabled || typeof api.getWeightEntries !== "function") return;
    let active = true;
    api.getWeightEntries().then((result) => {
      if (active) setEntries(result);
    }).catch(() => {
      // Estimates remain available with the backend's 75 kg fallback.
    });
    return () => { active = false; };
  }, [enabled]);

  if (entries.length === 0) return 75;
  const eligible = entries.filter((entry) => entry.date <= date);
  if (eligible.length > 0) {
    return eligible.reduce((latest, entry) => entry.date > latest.date ? entry : latest).weight_kg;
  }
  return entries.reduce((earliest, entry) => entry.date < earliest.date ? entry : earliest).weight_kg;
}

const cyclingSpeedAnchors = [8.9, 15.1, 17.6, 20.8, 24.1, 28.2, 32.2] as const;
const cyclingMetAnchors = [3.5, 5.8, 6.8, 8.0, 10.0, 12.0, 16.8] as const;

export function cyclingKcal(distanceKm: number, durationSeconds: number, weightKg: number): number {
  const hours = durationSeconds / 3600;
  if (hours <= 0 || distanceKm <= 0) return 0;
  const speed = distanceKm / hours;
let met: number = cyclingMetAnchors[0];
  if (speed >= cyclingSpeedAnchors[cyclingSpeedAnchors.length - 1]) {
    met = cyclingMetAnchors[cyclingMetAnchors.length - 1];
  } else if (speed > cyclingSpeedAnchors[0]) {
    for (let index = 1; index < cyclingSpeedAnchors.length; index += 1) {
      if (speed <= cyclingSpeedAnchors[index]) {
        const lowSpeed = cyclingSpeedAnchors[index - 1];
        const highSpeed = cyclingSpeedAnchors[index];
        const lowMet = cyclingMetAnchors[index - 1];
        const highMet = cyclingMetAnchors[index];
        met = lowMet + (highMet - lowMet) * (speed - lowSpeed) / (highSpeed - lowSpeed);
        break;
      }
    }
  }
  const kcal = (met - 1) * weightKg * hours;
  const scaled = kcal * 10;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const rounded = fraction === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(scaled);
  return rounded / 10;
}

export function runKcal(distanceKm: number, runType: "run" | "walk", weightKg: number): number {
  const kcal = (runType === "walk" ? 0.5 : 0.97) * weightKg * distanceKm;
  const scaled = kcal * 10;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const rounded = fraction === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(scaled);
  return rounded / 10;
}
