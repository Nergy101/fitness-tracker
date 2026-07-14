import { Minus as Minus, Plus as Plus } from "reicon-react";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Optional suffix rendered after the value, e.g. "s". */
  unit?: string;
  ariaLabel?: string;
}

/** Mobile-friendly number control: [−] value [+] with large tap targets,
 *  replacing the cramped native number spinner. */
export default function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  ariaLabel,
}: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => onChange(clamp(n));

  return (
    <div
      className="inline-flex items-center rounded-xl border border-fg/10 bg-surface overflow-hidden select-none"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => set(value - step)}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex items-center justify-center w-11 h-11 text-fg/70 hover:bg-fg/5 active:bg-fg/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Minus size={18} weight="Outline" strokeWidth={2} />
      </button>
      <div className="min-w-14 text-center text-sm font-semibold tabular-nums px-1">
        {value}
        {unit && <span className="text-fg/40 font-normal">{unit}</span>}
      </div>
      <button
        type="button"
        onClick={() => set(value + step)}
        disabled={value >= max}
        aria-label="Increase"
        className="flex items-center justify-center w-11 h-11 text-fg/70 hover:bg-fg/5 active:bg-fg/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Plus size={18} weight="Outline" strokeWidth={2} />
      </button>
    </div>
  );
}
