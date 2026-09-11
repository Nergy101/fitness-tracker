import {
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
} from "@phosphor-icons/react";
import { RING } from "./utils";

interface CooldownScreenProps {
  timerProgress: number;
  displayTime: string;
  breathPhase: "inhale" | "exhale";
  breathProgress: number;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
}

export default function CooldownScreen({
  timerProgress,
  displayTime,
  breathPhase,
  breathProgress,
  paused,
  onSkip,
  onTogglePause,
}: CooldownScreenProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 text-center"
      style={{ "--timer": "#3b82f6", background: "linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 60%, transparent 100%)" } as React.CSSProperties}
    >
      <p className="text-blue-400/70 text-sm mb-2 font-medium">Cooldown</p>
      <h2 className="text-2xl font-bold text-blue-400 mb-6">
        Breathe and recover
      </h2>
      <div className="relative w-48 h-48 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="#3b82f6"
            strokeWidth="6"
            strokeDasharray={RING}
            strokeDashoffset={(1 - timerProgress) * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-blue-400">{displayTime}</span>
        </div>
      </div>
      {/* Breathing cue */}
      <div className="mb-4">
        <p
          className={`text-3xl font-bold transition-all duration-300 ${
            breathPhase === "inhale" ? "text-blue-300 scale-110" : "text-blue-400/60 scale-100"
          }`}
        >
          {breathPhase === "inhale" ? "Inhale" : "Exhale"}
        </p>
        <div className="w-32 h-1.5 bg-fg/10 rounded-full mt-2 mx-auto overflow-hidden">
          <div
            className="h-full bg-blue-400/50 rounded-full transition-all duration-300"
            style={{ width: `${breathProgress * 100}%` }}
          />
        </div>
      </div>
      <p className="text-fg/30 text-sm mb-4">Cooling down...</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
        >
          <SkipForward size={16} weight="fill" /> Skip cooldown
        </button>
        <button
          onClick={onTogglePause}
          className="inline-flex items-center gap-2 text-sm text-blue-400/60 hover:text-blue-400 border border-blue-400/20 hover:border-blue-400/40 rounded-xl px-5 py-2 transition-colors"
        >
          {paused ? <PlayCircle size={16} weight="fill" /> : <PauseCircle size={16} weight="fill" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
