import {
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
} from "@phosphor-icons/react";
import ExerciseImage from "../ExerciseImage";
import { RING } from "./utils";

interface RestScreenProps {
  currentName: string;
  currentImage: string | null;
  currentCategory?: string;
  currentDescription: string;
  currentPastHint: string | null;
  restTimerColor: string;
  restProgress: number;
  restCountdown: number;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
}

export default function RestScreen({
  currentName,
  currentImage,
  currentCategory,
  currentDescription,
  currentPastHint,
  restTimerColor,
  restProgress,
  restCountdown,
  paused,
  onSkip,
  onTogglePause,
}: RestScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-fg/40 mb-2">Next up</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-fg mb-5">{currentName}</h2>
      <ExerciseImage
        src={currentImage}
        alt={currentName}
        className="w-56 h-40 rounded-2xl mb-4 border border-fg/10 shadow-[var(--shadow-sm)]"
        category={currentCategory}
      />
      {currentDescription && (
        <p className="text-fg/50 text-sm max-w-xs mb-3">{currentDescription}</p>
      )}
      {currentPastHint && (
        <p className="text-accent/70 text-xs mb-4 font-medium">{currentPastHint}</p>
      )}
      <div className="relative w-56 h-56 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={restTimerColor} strokeWidth="8"
            strokeDasharray={RING}
            strokeDashoffset={restProgress * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-extrabold tracking-tight tabular-nums" style={{ color: restTimerColor }}>{restCountdown}</span>
        </div>
      </div>
      <p className="text-fg/30 text-sm mb-5">Get ready...</p>
      <div className="flex items-center gap-3 w-full max-w-xs">
        <button
          onClick={onSkip}
          className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-fg/70 border border-fg/10 hover:bg-fg/5 active:bg-fg/10 rounded-xl px-4 transition-colors"
        >
          <SkipForward size={18} weight="fill" /> Skip rest
        </button>
        <button
          onClick={onTogglePause}
          className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold text-accent bg-accent/15 border border-accent/30 hover:bg-accent/25 active:scale-[0.98] rounded-xl px-4 transition"
        >
          {paused ? <PlayCircle size={18} weight="fill" /> : <PauseCircle size={18} weight="fill" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
