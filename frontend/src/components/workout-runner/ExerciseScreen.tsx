import {
  ArrowsLeftRightIcon as ArrowsLeftRight,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
} from "@phosphor-icons/react";
import ExerciseImage from "../ExerciseImage";
import { RING } from "./utils";

interface ExerciseScreenProps {
  isAmrap: boolean;
  isEmom: boolean;
  amrapRounds: number;
  currentIndex: number;
  totalExercises: number;
  currentSupersetGroup: number | null;
  rounds: number;
  currentRound: number;
  currentName: string;
  currentImage: string | null;
  currentCategory?: string;
  currentDescription: string;
  currentPastHint: string | null;
  weightValue: string;
  repsValue: string;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  paused: boolean;
  weightError: string | null;
  repsError: string | null;
  weightConfirm: boolean;
  repsConfirm: boolean;
  timerProgress: number;
  displayTime: string;
  hasLoggedSets: boolean;
  onOpenSwap: () => void;
  onSkip: () => void;
  onUndoLastSet: () => void;
  onTogglePause: () => void;
  rpeValue: number | null;
  onRpeChange: (value: number | null) => void;
  notesOpen: boolean;
  onToggleNotes: () => void;
  notesValue: string;
  onNotesChange: (value: string) => void;
}

export default function ExerciseScreen({
  isAmrap,
  isEmom,
  amrapRounds,
  currentIndex,
  totalExercises,
  currentSupersetGroup,
  rounds,
  currentRound,
  currentName,
  currentImage,
  currentCategory,
  currentDescription,
  currentPastHint,
  weightValue,
  repsValue,
  onWeightChange,
  onRepsChange,
  paused,
  weightError,
  repsError,
  weightConfirm,
  repsConfirm,
  timerProgress,
  displayTime,
  hasLoggedSets,
  onOpenSwap,
  onSkip,
  onUndoLastSet,
  onTogglePause,
  rpeValue,
  onRpeChange,
  notesOpen,
  onToggleNotes,
  notesValue,
  onNotesChange,
}: ExerciseScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <p className="text-fg/50 text-sm mb-2">
        {isAmrap ? `Round ${amrapRounds}` : isEmom ? `Exercise ${currentIndex + 1} of ${totalExercises}` : `Exercise ${currentIndex + 1} of ${totalExercises}`}
        {currentSupersetGroup && (
          <span className="text-accent/70 ml-1.5 font-semibold text-xs">SS</span>
        )}
        {!isAmrap && !isEmom && rounds > 1 && (
          <span className="text-accent"> &middot; Round {currentRound + 1}/{rounds}</span>
        )}
        {isAmrap && (
          <span className="text-accent"> &middot; AMRAP</span>
        )}
      </p>
      <h2 className="text-2xl font-bold text-fg mb-6">
        {currentName}
        <button
          onClick={onOpenSwap}
          className="ml-2 inline-flex items-center text-fg/30 hover:text-accent transition-colors align-middle"
          title="Swap exercise"
        >
          <ArrowsLeftRight size={20} weight="bold" />
        </button>
      </h2>
      <ExerciseImage
        src={currentImage}
        alt={currentName}
        className="w-56 h-40 rounded-2xl mb-3 border border-fg/10"
        category={currentCategory}
      />
      {currentDescription && (
        <p className="text-fg/50 text-sm max-w-xs mb-3">{currentDescription}</p>
      )}
      {currentPastHint && (
        <p className="text-accent/70 text-xs mb-3 font-medium">{currentPastHint}</p>
      )}
      {/* Weight / reps logging */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="kg"
            value={weightValue}
            onChange={(e) => onWeightChange(e.target.value)}
            disabled={paused}
            className={`w-20 bg-surface border rounded-lg px-3 py-2 text-center text-sm text-fg placeholder-fg/20 focus:outline-none focus:border-accent/50 disabled:opacity-40 ${
              weightError ? "border-red-400" : "border-fg/10"
            }`}
            aria-label="Weight in kg"
          />
          <span className="text-fg/20 text-sm">×</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="reps"
            value={repsValue}
            onChange={(e) => onRepsChange(e.target.value)}
            disabled={paused}
            className={`w-20 bg-surface border rounded-lg px-3 py-2 text-center text-sm text-fg placeholder-fg/20 focus:outline-none focus:border-accent/50 disabled:opacity-40 ${
              repsError ? "border-red-400" : "border-fg/10"
            }`}
            aria-label="Reps"
          />
        </div>
        {(weightConfirm || repsConfirm) && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 22h20L12 2z"/></svg>
            <span>Are you sure? The value will be saved anyway.</span>
          </div>
        )}
        {(weightError && !weightConfirm) && (
          <p className="text-xs text-red-400">{weightError}</p>
        )}
        {(repsError && !repsConfirm) && (
          <p className="text-xs text-red-400">{repsError}</p>
        )}
      </div>
      <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
        <span className="text-[10px] text-fg/30 mr-1 uppercase tracking-wide">RPE</span>
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <button key={n} onClick={() => onRpeChange(rpeValue === n ? null : n)} disabled={paused} aria-label={`RPE ${n}`} className={`w-6 h-6 rounded-full text-[11px] font-medium ${rpeValue === n ? "bg-accent text-on-accent" : "bg-surface border border-fg/10 text-fg/50"}`}>{n}</button>
        ))}
      </div>
      <button type="button" onClick={onToggleNotes} disabled={paused} aria-label="Toggle set notes" className="text-[11px] text-fg/40 mt-1">{notesOpen ? "▲ Hide set note" : "▼ Add set note"}</button>
      {notesOpen && <input type="text" value={notesValue} onChange={(e) => onNotesChange(e.target.value)} disabled={paused} aria-label="Set notes" className="w-full max-w-xs mt-1.5 bg-surface border border-fg/10 rounded-lg px-3 py-1.5 text-sm text-fg" />}
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={isAmrap ? "#f97316" : "var(--timer)"}
            strokeWidth="6"
            strokeDasharray={RING}
            strokeDashoffset={(1 - timerProgress) * RING}
            strokeLinecap="round"
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-fg">{displayTime}</span>
        </div>
      </div>
      {isAmrap && (
        <p className="text-fg/30 text-xs mb-1">Rounds completed: {amrapRounds}</p>
      )}
      <p className="text-fg/30 text-sm">{isAmrap ? "Go!" : isEmom ? "Go!" : "Go!"}</p>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
        >
          <SkipForward size={16} weight="fill" /> Skip
        </button>
        {hasLoggedSets && (
          <button
            onClick={onUndoLastSet}
            className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
            aria-label="Undo last set"
            title="Undo last set"
          >
            <ArrowCounterClockwise size={16} weight="fill" /> Undo last set
          </button>
        )}
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
