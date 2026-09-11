interface StopConfirmDialogProps {
  onKeepGoing: () => void;
  onStop: () => void;
}

export default function StopConfirmDialog({ onKeepGoing, onStop }: StopConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-xs bg-surface rounded-2xl border border-fg/10 p-6 text-center">
        <h3 className="text-base font-semibold text-fg mb-2">Stop workout?</h3>
        <p className="text-sm text-fg/50 mb-5">Progress on this session will be discarded.</p>
        <div className="flex gap-2">
          <button
            onClick={onKeepGoing}
            className="flex-1 text-sm text-fg/60 hover:text-fg border border-fg/15 rounded-xl py-2.5 transition-colors"
          >
            Keep going
          </button>
          <button
            onClick={onStop}
            className="flex-1 text-sm text-red-300 hover:text-red-200 border border-red-400/30 hover:border-red-400/50 rounded-xl py-2.5 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
