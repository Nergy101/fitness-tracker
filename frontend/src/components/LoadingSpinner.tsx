import { useState } from "react";
import { ACTIVITY_COLORS } from "../activity";

/** Ring loader that spins one full rotation in a single solid activity color,
 *  then advances to the next color on each subsequent rotation. The starting
 *  color is randomized per mount; the cycle still visits all three activity
 *  colors in order. Rotation and color-cycle animations are phase-locked: 1s
 *  per rotation, 3s step-end color cycle. */
const TAIL = `conic-gradient(from 0deg, transparent, var(--spin-color))`;
const PALETTE = [ACTIVITY_COLORS.workout, ACTIVITY_COLORS.run, ACTIVITY_COLORS.walk];

export default function LoadingSpinner({
  label = "Loading",
  size = 36,
}: {
  label?: string;
  size?: number;
}) {
  const thickness = Math.max(3, Math.round(size / 9));
  const hole = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`;
  // Pick a random starting color once per mount, then cycle from there.
  const [start] = useState(() => Math.floor(Math.random() * PALETTE.length));
  const colors = [0, 1, 2].map((i) => PALETTE[(start + i) % PALETTE.length]);
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
              "--spin-c0": colors[0],
              "--spin-c1": colors[1],
              "--spin-c2": colors[2],
            } as React.CSSProperties
          }
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
