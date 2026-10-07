interface StopConfirmDialogProps {
  onKeepGoing: () => void;
  onStop: () => void;
}

export default function StopConfirmDialog({ onKeepGoing, onStop }: StopConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-xs bg-surface rounded-2xl border border-fg/10 shadow-[var(--shadow-lg)] p-6 text-center">
        <h3 className="text-lg font-bold tracking-tight text-fg mb-2">Stop workout?</h3>
        <p className="text-sm text-fg/50 mb-6">Progress on this session will be discarded.</p>
        <div className="flex gap-3">
          <button
            onClick={onKeepGoing}
            className="flex-1 min-h-12 text-sm font-semibold text-fg/70 border border-fg/10 hover:bg-fg/5 active:bg-fg/10 rounded-xl transition-colors"
          >
            Keep going
          </button>
          <button
            onClick={onStop}
            className="flex-1 min-h-12 text-sm font-semibold text-red-300 bg-red-500/10 border border-red-400/30 hover:bg-red-500/20 active:scale-[0.98] rounded-xl transition"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
