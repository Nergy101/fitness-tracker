import { ACTIVITY_COLORS } from "../activity";

/** Conic-gradient ring that sweeps through the activity palette
 *  (workout → run → walk) as it spins — the shared app loader. */
const RING = `conic-gradient(from 0deg, ${ACTIVITY_COLORS.workout}, ${ACTIVITY_COLORS.run}, ${ACTIVITY_COLORS.walk}, ${ACTIVITY_COLORS.workout})`;

export default function LoadingSpinner({
  label = "Loading",
  size = 36,
}: {
  label?: string;
  size?: number;
}) {
  const thickness = Math.max(3, Math.round(size / 9));
  const hole = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`;
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-8 text-fg/40"
      role="status"
      aria-label={label}
    >
      <span
        className="animate-spin rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          background: RING,
          WebkitMask: hole,
          mask: hole,
        }}
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
