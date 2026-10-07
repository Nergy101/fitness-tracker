import {
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
} from "@phosphor-icons/react";
import { RING } from "./utils";

interface WarmupScreenProps {
  timerProgress: number;
  displayTime: string;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
}

export default function WarmupScreen({
  timerProgress,
  displayTime,
  paused,
  onSkip,
  onTogglePause,
}: WarmupScreenProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 text-center"
      style={{ "--timer": "#22c55e", background: "linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 60%, transparent 100%)" } as React.CSSProperties}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/70 mb-2">Warmup</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-emerald-400 mb-6">
        Get ready to move
      </h2>
      <p className="text-fg/40 text-sm max-w-xs mb-5 leading-relaxed">
        Jumping jacks, arm circles, leg swings, light jogging — loosen up and get the blood flowing.
      </p>
      <div className="relative w-56 h-56 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="#22c55e"
            strokeWidth="8"
            strokeDasharray={RING}
            strokeDashoffset={(1 - timerProgress) * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-extrabold tracking-tight tabular-nums text-emerald-400">{displayTime}</span>
        </div>
      </div>
      <p className="text-fg/30 text-sm mb-5">Warming up...</p>
      <div className="flex items-center gap-3 w-full max-w-xs">
        <button
          onClick={onSkip}
          className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-fg/70 border border-fg/10 hover:bg-fg/5 active:bg-fg/10 rounded-xl px-4 transition-colors"
        >
          <SkipForward size={18} weight="fill" /> Skip warmup
        </button>
        <button
          onClick={onTogglePause}
          className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 hover:bg-emerald-400/25 active:scale-[0.98] rounded-xl px-4 transition"
        >
          {paused ? <PlayCircle size={18} weight="fill" /> : <PauseCircle size={18} weight="fill" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
