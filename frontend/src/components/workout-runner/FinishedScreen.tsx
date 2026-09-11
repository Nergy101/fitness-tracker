import { TrophyIcon as Trophy } from "@phosphor-icons/react";
import { formatDuration } from "../../format";

interface FinishedScreenProps {
  isAmrap: boolean;
  timeCap: number;
  totalDuration: number;
  totalExercises: number;
  amrapRounds: number;
  setCount: number;
  totalKcal: number;
  hasPr: boolean;
  workoutName: string;
  sessionDate: string;
  setSessionDate: (value: string) => void;
  notePrompt: string;
  sessionNotes: string;
  setSessionNotes: (value: string) => void;
  saving: boolean;
  onDone: () => void;
}

export default function FinishedScreen({
  isAmrap,
  timeCap,
  totalDuration,
  totalExercises,
  amrapRounds,
  setCount,
  totalKcal,
  hasPr,
  workoutName,
  sessionDate,
  setSessionDate,
  notePrompt,
  sessionNotes,
  setSessionNotes,
  saving,
  onDone,
}: FinishedScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center celebrate-in">
      <style>{`@keyframes celebrate-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } } .celebrate-in { animation: celebrate-in 350ms cubic-bezier(0.34,1.56,0.64,1); }`}</style>
      <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-fg mb-2">
        {isAmrap ? "Time!" : "Workout Complete!"}
      </h2>
      <p className="text-fg/50 text-sm mb-4">{workoutName || "Workout"}</p>

      {hasPr && (
        <div className="flex items-center gap-1.5 text-yellow-400 text-sm font-semibold mb-4">
          <Trophy size={16} weight="fill" />
          New personal best!
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-8 w-full max-w-md">
        <div className="bg-surface rounded-xl p-3">
          <p className="text-xl font-bold text-fg">
            {isAmrap ? formatDuration(timeCap) : `${Math.floor(totalDuration / 60)}m`}
          </p>
          <p className="text-xs text-fg/40">Duration</p>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <p className="text-xl font-bold text-fg">
            {isAmrap ? amrapRounds : totalExercises}
          </p>
          <p className="text-xs text-fg/40">{isAmrap ? "Rounds" : "Exercises"}</p>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <p className="text-xl font-bold text-fg">{setCount}</p>
          <p className="text-xs text-fg/40">Sets</p>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <p className="text-xl font-bold text-accent">{Math.round(totalKcal)}</p>
          <p className="text-xs text-fg/40">Kcal</p>
        </div>
      </div>

      {isAmrap && (
        <p className="text-fg/40 text-sm mb-4">
          {amrapRounds} round{amrapRounds !== 1 ? "s" : ""} in {formatDuration(timeCap)}
        </p>
      )}

      <div className="mb-5 w-full max-w-xs">
        <label className="text-xs text-fg/40 block mb-1.5">When was this workout?</label>
        <input
          type="datetime-local"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm text-fg outline-none focus:border-accent/50"
        />
      </div>

      <div className="mb-5 w-full max-w-xs">
        <label className="text-xs text-fg/40 block mb-1.5">{notePrompt} (optional)</label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Any notes about this workout..."
          rows={3}
          className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm text-fg outline-none focus:border-accent/50 resize-none placeholder:text-fg/20"
          aria-label="Session notes"
        />
      </div>

      <button
        onClick={onDone}
        disabled={saving}
        className="bg-accent text-on-accent rounded-xl px-8 py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {saving ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {saving ? "Saving..." : "Done"}
      </button>
    </div>
  );
}
