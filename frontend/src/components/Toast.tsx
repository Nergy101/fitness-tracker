import { useEffect, useRef, type ReactNode } from "react";

interface ToastProps {
  onDismiss: () => void;
  duration?: number;
  children: ReactNode;
}

/** Bottom-center status pill that dismisses itself after `duration` ms. */
export default function Toast({ onDismiss, duration = 2500, children }: ToastProps) {
  // Keep the latest callback without restarting the timer on parent re-renders.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const id = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(id);
  }, [duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] flex items-center gap-2 bg-accent text-on-accent rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg"
    >
      {children}
    </div>
  );
}
