import { ACTIVITY_COLORS } from "../activity";

/** Ring loader that spins one full rotation in a single solid activity color,
 *  then advances to the next color on each subsequent rotation (workout → run
 *  → walk → …). Rotation and color-cycle animations are phase-locked: 1s per
 *  rotation, 3s step-end color cycle. */
const TAIL = `conic-gradient(from 0deg, transparent, var(--spin-color))`;

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
        style={{ width: size, height: size }}
      >
        <span
          className="block rounded-full"
          style={
            {
              width: "100%",
              height: "100%",
              background: TAIL,
              WebkitMask: hole,
              mask: hole,
              animation: "spin-color 3s step-end infinite",
              "--spin-c0": ACTIVITY_COLORS.workout,
              "--spin-c1": ACTIVITY_COLORS.run,
              "--spin-c2": ACTIVITY_COLORS.walk,
            } as React.CSSProperties
          }
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
