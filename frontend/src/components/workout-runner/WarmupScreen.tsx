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
      <p className="text-emerald-400/70 text-sm mb-2 font-medium">Warmup</p>
      <h2 className="text-2xl font-bold text-emerald-400 mb-6">
        Get ready to move
      </h2>
      <p className="text-fg/40 text-sm max-w-xs mb-4 leading-relaxed">
        Jumping jacks, arm circles, leg swings, light jogging — loosen up and get the blood flowing.
      </p>
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="#22c55e"
            strokeWidth="6"
            strokeDasharray={RING}
            strokeDashoffset={(1 - timerProgress) * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-emerald-400">{displayTime}</span>
        </div>
      </div>
      <p className="text-fg/30 text-sm mb-4">Warming up...</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
        >
          <SkipForward size={16} weight="fill" /> Skip warmup
        </button>
        <button
          onClick={onTogglePause}
          className="inline-flex items-center gap-2 text-sm text-emerald-400/60 hover:text-emerald-400 border border-emerald-400/20 hover:border-emerald-400/40 rounded-xl px-5 py-2 transition-colors"
        >
          {paused ? <PlayCircle size={16} weight="fill" /> : <PauseCircle size={16} weight="fill" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
