/** Smooth SVG path helpers shared by the line/band/area charts.
 *  Produces a Catmull-Rom-derived cubic Bezier through a point series so
 *  trends read as a curve instead of a jagged polyline, without changing
 *  any of the underlying data math (axis scaling stays with the caller —
 *  these only turn already-projected {x,y} pixel points into a `d` string). */

export type PathPt = { x: number; y: number };

const SMOOTHING = 0.18;

function controlPoint(
  prev: PathPt | undefined,
  cur: PathPt,
  next: PathPt | undefined,
  reverse: boolean,
): PathPt {
  const p = prev ?? cur;
  const n = next ?? cur;
  const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0);
  const length = Math.hypot(n.x - cur.x, n.y - cur.y) * SMOOTHING;
  return { x: cur.x + Math.cos(angle) * length, y: cur.y + Math.sin(angle) * length };
}

/** "M x0 y0 C …" smoothed path through `points` (needs >= 1 point). */
export function smoothLinePath(points: PathPt[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1 = controlPoint(points[i - 2], points[i - 1], points[i], false);
    const cp2 = controlPoint(points[i - 1], points[i], points[i + 1], true);
    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/** Smoothed line closed down to `baseY`, for a gradient area fill under a
 *  trend line. Returns "" for fewer than 2 points (nothing to fill). */
export function smoothAreaPath(points: PathPt[], baseY: number): string {
  if (points.length < 2) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${smoothLinePath(points)} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

/** Top-only-rounded bar: flat bottom (sits flush on the axis or the segment
 *  below it in a stack), rounded top-left/top-right corners. Mirrors the
 *  `TopRoundedRect` fix in StatsTab (rect `rx` rounds all four corners,
 *  which notches stacked segments — path-based rounding avoids that). */
export function topRoundedBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (r === 0) return `M ${x} ${y + height} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} Z`;
  return `M ${x} ${y + height} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + width - r} ${y} A ${r} ${r} 0 0 1 ${x + width} ${y + r} L ${x + width} ${y + height} Z`;
}
