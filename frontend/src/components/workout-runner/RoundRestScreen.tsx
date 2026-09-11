import {
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
} from "@phosphor-icons/react";
import { RING } from "./utils";

interface RoundRestScreenProps {
  currentRound: number;
  isAmrap: boolean;
  rounds: number;
  restProgress: number;
  restClock: string;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
}

export default function RoundRestScreen({
  currentRound,
  isAmrap,
  rounds,
  restProgress,
  restClock,
  paused,
  onSkip,
  onTogglePause,
}: RoundRestScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <p className="text-fg/50 text-sm mb-2">Round rest</p>
      <h2 className="text-2xl font-bold text-fg mb-6">
        Round {currentRound + 1}/{isAmrap ? "∞" : rounds} next
      </h2>
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="var(--accent)" strokeWidth="6"
            strokeDasharray={RING}
            strokeDashoffset={restProgress * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-accent">{restClock}</span>
        </div>
      </div>
      <p className="text-fg/30 text-sm mb-4">Catch your breath</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
        >
          <SkipForward size={16} weight="fill" /> Skip rest
        </button>
        <button
          onClick={onTogglePause}
          className="inline-flex items-center gap-2 text-sm text-accent/60 hover:text-accent border border-accent/20 hover:border-accent/40 rounded-xl px-5 py-2 transition-colors"
        >
          {paused ? <PlayCircle size={16} weight="fill" /> : <PauseCircle size={16} weight="fill" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
