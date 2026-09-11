import type { RefObject } from "react";
import type { Exercise } from "../../api";
import ExerciseImage from "../ExerciseImage";

interface SwapExercisePickerProps {
  swapRef: RefObject<HTMLDivElement | null>;
  closeSwap: () => void;
  swapSearch: string;
  setSwapSearch: (value: string) => void;
  filteredSwapExercises: Exercise[];
  allExercises: Exercise[];
  doSwap: (newExercise: Exercise) => void;
}

export default function SwapExercisePicker({
  swapRef,
  closeSwap,
  swapSearch,
  setSwapSearch,
  filteredSwapExercises,
  allExercises,
  doSwap,
}: SwapExercisePickerProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={closeSwap}
    >
      <div
        ref={swapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Swap exercise"
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] border border-fg/10 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Swap Exercise</h3>
          <button
            onClick={closeSwap}
            className="text-fg/40 hover:text-fg text-xl"
          >
            &times;
          </button>
        </div>
        <input
          type="text"
          placeholder="Search exercises..."
          value={swapSearch}
          onChange={(e) => setSwapSearch(e.target.value)}
          className="w-full bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none mb-3 focus:border-accent/50"
        />
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredSwapExercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => doSwap(ex)}
            className="w-full text-left bg-bg rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-fg/5 transition-colors"
          >
            <div className="w-10 h-10 shrink-0">
              <ExerciseImage
                src={ex.image_url}
                alt={ex.name}
                className="w-10 h-10 rounded-lg bg-fg/5"
                category={ex.category}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">{ex.name}</p>
              <p className="text-[10px] text-fg/40 capitalize">{ex.category}</p>
            </div>
          </button>
        ))}
          {filteredSwapExercises.length === 0 && allExercises.length > 0 && (
            <div className="text-xs text-fg/30 text-center py-4">
              No exercises match
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
