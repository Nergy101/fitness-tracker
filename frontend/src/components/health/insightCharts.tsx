/**
 * Composable SVG chart primitives for the Apple Health charts.
 * Each component renders only the SVG — the caller provides the card wrapper.
 *
 * Shared axis conventions (matching the Stats tab's weekly chart):
 *   - left gutter with 2–3 "nice" y ticks, dashed fg/10 gridlines
 *   - three x-axis date labels (first / middle / last) via `xLabels`
 *   - dual-axis charts tint each side's tick labels in its series color
 */

import { fmtTick, niceTicks } from "./ticks";

const W = 300;
const H = 100;
const GL = 30; // left gutter: y-axis tick labels
export const ACCENT = "#4cb782";

function yN(v: number, lo: number, hi: number): number {
  return hi === lo ? H / 2 : H - ((v - lo) / (hi - lo)) * H;
}

/** Dashed gridlines + right-aligned tick labels in the left gutter. */
function YGrid({
  ticks,
  yOf,
  format = fmtTick,
  right = W,
  color,
}: {
  ticks: number[];
  yOf: (v: number) => number;
  format?: (v: number) => string;
  right?: number;
  color?: string;
}) {
  return (
    <>
      {ticks.map((t) => {
        const y = yOf(t);
        if (y < 4 || y > H) return null;
        return (
          <g key={t}>
            <line x1={GL} y1={y} x2={right} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
            <text
              x={GL - 4}
              y={Math.max(y + 2.5, 7)}
              textAnchor="end"
              fontSize="8"
              {...(color ? { fill: color, opacity: 0.8 } : { className: "fill-fg/30" })}
            >
              {format(t)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Three x-axis labels (first / middle / last) under the plot. */
function XLabels({ labels, xOf, y = H + 14 }: { labels: [string, string, string]; xOf: (j: number) => number; y?: number }) {
  return (
    <>
      {labels.map((l, j) => (
        <text key={j} x={xOf(j)} y={y} textAnchor="middle" className="fill-fg/40" fontSize="9">
          {l}
        </text>
      ))}
    </>
  );
}

/** xOf for XLabels over an index-based plot of n slots starting at `left`. */
function threeSlotX(n: number, left: number, right: number): (j: number) => number {
  const idxs = [0, Math.floor(n / 2), n - 1];
  const slotW = (right - left) / n;
  return (j: number) => left + idxs[j] * slotW + slotW / 2;
}

// ─── Shared point types ───────────────────────────────────────────────────────

export type LPt = { x: number; y: number };
export type BPt = { x: number; y: number; color?: string };
export type SPt = { x: number; y: number; color?: string };
export type BandPt = { x: number; avg: number; min: number; max: number };
export type DualPt = { x: number; bar: number; line: number | null };

// ─── BarChart ─────────────────────────────────────────────────────────────────
// Index-based x (equal-width bars with 1 px gap).
// Per-point color supported via BPt.color.
// overlay = same-length line series (rolling avg) over bars.

interface BarChartProps {
  points: BPt[];
  defaultColor?: string;
  goalValue?: number;
  goalLabel?: string;
  overlay?: LPt[];
  formatY?: (v: number) => string;
  xLabels?: [string, string, string];
}

export function BarChart({
  points,
  defaultColor = ACCENT,
  goalValue,
  goalLabel,
  overlay,
  formatY,
  xLabels,
}: BarChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const ys = points.map((p) => p.y);
  const dataMax = Math.max(...ys);
  // headroom: at least 10 % above data max or goal
  const ceiling = Math.max(dataMax, goalValue ?? 0);
  const yMax = ceiling * 1.1 || 1;

  const slotW = (W - GL) / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => GL + i * slotW;
  const bCX = (i: number) => GL + i * slotW + barW / 2;
  const bY = (v: number) => H - (v / yMax) * H;
  const bH = (v: number) => Math.max(0, (v / yMax) * H);
  const goalY = goalValue != null ? bY(goalValue) : null;

  const avgPts = overlay?.length
    ? overlay.map((p, i) => `${bCX(i)},${bY(p.y)}`).join(" ")
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      <YGrid ticks={niceTicks(0, yMax).filter((t) => t > 0)} yOf={bY} format={formatY ?? fmtTick} />
      {points.map((p, i) => (
        <rect
          key={i}
          x={bX(i)}
          y={bY(p.y)}
          width={barW}
          height={bH(p.y)}
          fill={p.color ?? defaultColor}
          opacity="0.8"
        />
      ))}
      {goalY != null && (
        <>
          <line x1={GL} y1={goalY} x2={W} y2={goalY} stroke={ACCENT} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          {goalLabel && (
            <text x={W - 2} y={goalY - 3} textAnchor="end" className="fill-fg/40" fontSize="8">
              {goalLabel}
            </text>
          )}
        </>
      )}
      {avgPts && (
        <polyline
          points={avgPts}
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {xLabels && <XLabels labels={xLabels} xOf={threeSlotX(n, GL, W)} />}
    </svg>
  );
}

// ─── DailyStackedBarChart ─────────────────────────────────────────────────────
// Index-based x like BarChart; each bar is a bottom-up stack of segments.
// Bar height = sum of segment values (e.g. sleep stages summing to totalSleep).

export type StackSeg = { value: number; color: string };
export type StkPt = { x: number; segments: StackSeg[] };

interface DailyStackedBarChartProps {
  points: StkPt[];
  goalValue?: number;
  goalLabel?: string;
  formatY?: (v: number) => string;
  xLabels?: [string, string, string];
}

export function DailyStackedBarChart({ points, goalValue, goalLabel, formatY, xLabels }: DailyStackedBarChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const totals = points.map((p) => p.segments.reduce((s, seg) => s + seg.value, 0));
  const dataMax = Math.max(...totals);
  const ceiling = Math.max(dataMax, goalValue ?? 0);
  const yMax = ceiling * 1.1 || 1;

  const slotW = (W - GL) / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => GL + i * slotW;
  const yOf = (v: number) => H - (v / yMax) * H;
  const segH = (v: number) => Math.max(0, (v / yMax) * H);
  const goalY = goalValue != null ? yOf(goalValue) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      <YGrid ticks={niceTicks(0, yMax).filter((t) => t > 0)} yOf={yOf} format={formatY ?? fmtTick} />
      {points.map((p, i) => {
        let y = H;
        return p.segments.map((seg, si) => {
          const h = segH(seg.value);
          y -= h;
          return <rect key={`${i}-${si}`} x={bX(i)} y={y} width={barW} height={h} fill={seg.color} opacity="0.85" />;
        });
      })}
      {goalY != null && (
        <>
          <line x1={GL} y1={goalY} x2={W} y2={goalY} stroke={ACCENT} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          {goalLabel && (
            <text x={W - 2} y={goalY - 3} textAnchor="end" className="fill-fg/40" fontSize="8">
              {goalLabel}
            </text>
          )}
        </>
      )}
      {xLabels && <XLabels labels={xLabels} xOf={threeSlotX(n, GL, W)} />}
    </svg>
  );
}

// ─── ScatterChart ─────────────────────────────────────────────────────────────
// Actual x/y values mapped to chart space, with numeric ticks on both axes.
// Minimum 3 points required (enforced externally; returns null for <3).

interface ScatterChartProps {
  points: SPt[];
  color?: string;
  xLabel?: string;
}

export function ScatterChart({ points, color = ACCENT, xLabel }: ScatterChartProps) {
  const n = points.length;
  if (n < 3) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xLo = Math.min(...xs);
  const xHi = Math.max(...xs);
  const yLo = Math.min(...ys);
  const yHi = Math.max(...ys);
  const xPad = xHi === xLo ? 1 : (xHi - xLo) * 0.05;
  const yPad = yHi === yLo ? 1 : (yHi - yLo) * 0.1;

  const ptX = (x: number) =>
    GL + ((x - (xLo - xPad)) / (xHi + xPad - (xLo - xPad))) * (W - GL);
  const ptY = (y: number) => yN(y, yLo - yPad, yHi + yPad);

  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full">
      <YGrid ticks={niceTicks(yLo, yHi)} yOf={ptY} />
      {niceTicks(xLo, xHi).map((t) => (
        <g key={t}>
          <line x1={ptX(t)} y1={0} x2={ptX(t)} y2={H} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
          <text x={ptX(t)} y={H + 9} textAnchor="middle" className="fill-fg/30" fontSize="8">
            {fmtTick(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={ptX(p.x)} cy={ptY(p.y)} r="3" fill={p.color ?? color} opacity="0.85" />
      ))}
      {xLabel && (
        <text x={GL + (W - GL) / 2} y={H + 22} textAnchor="middle" className="fill-fg/40" fontSize="9">
          {xLabel}
        </text>
      )}
    </svg>
  );
}

// ─── BandChart ────────────────────────────────────────────────────────────────
// Shaded min–max band + avg centre line.

interface BandChartProps {
  points: BandPt[];
  color?: string;
  xLabels?: [string, string, string];
}

export function BandChart({ points, color = ACCENT, xLabels }: BandChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const allVals = points.flatMap((p) => [p.min, p.max, p.avg]);
  const lo = Math.min(...allVals);
  const hi = Math.max(...allVals);
  const pad = hi === lo ? 2 : (hi - lo) * 0.1;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const xOf = (i: number) => GL + (n === 1 ? (W - GL) / 2 : (i / (n - 1)) * (W - GL));
  const yOf = (v: number) => yN(v, yLo, yHi);

  // Polygon: max edge left→right, min edge right→left
  const topEdge = points.map((p, i) => `${xOf(i)},${yOf(p.max)}`).join(" ");
  const botEdge = [...points].reverse().map((p, i) => `${xOf(n - 1 - i)},${yOf(p.min)}`).join(" ");

  const avgLine = points.map((p, i) => `${xOf(i)},${yOf(p.avg)}`).join(" ");

  const lblIdxs = [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      <YGrid ticks={niceTicks(yLo, yHi)} yOf={yOf} />
      <polygon points={`${topEdge} ${botEdge}`} fill={color} opacity="0.15" />
      <polyline
        points={avgLine}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xLabels && <XLabels labels={xLabels} xOf={(j) => xOf(lblIdxs[j])} />}
    </svg>
  );
}

// ─── DualAxisChart ────────────────────────────────────────────────────────────
// Bars on the RIGHT axis scale + line on the LEFT axis scale; each side's tick
// labels are tinted in its series color so the two scales read unambiguously.
// Line gaps (null) break the polyline into separate segments; dots mark every
// point so sparse series stay visible.

const GR = 30; // right gutter: bar-scale tick labels

interface DualAxisChartProps {
  points: DualPt[];
  barColor?: string;
  lineColor?: string;
  barLabel?: string;
  lineLabel?: string;
  xLabels?: [string, string, string];
}

export function DualAxisChart({
  points,
  barColor = ACCENT,
  lineColor = "#38bdf8",
  barLabel,
  lineLabel,
  xLabels,
}: DualAxisChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const barVals = points.map((p) => p.bar);
  const lineVals = points.filter((p) => p.line != null).map((p) => p.line as number);
  const barMax = (Math.max(...barVals) || 1) * 1.1;
  const lineLo = lineVals.length ? Math.min(...lineVals) : 0;
  const lineHi = lineVals.length ? Math.max(...lineVals) : 1;
  const linePad = lineHi === lineLo ? 2 : (lineHi - lineLo) * 0.15;

  const right = W - GR;
  const slotW = (right - GL) / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => GL + i * slotW;
  const bCX = (i: number) => GL + i * slotW + barW / 2;
  const bY = (v: number) => H - (v / barMax) * H;
  const bH = (v: number) => Math.max(0, (v / barMax) * H);
  const lY = (v: number) => yN(v, lineLo - linePad, lineHi + linePad);

  const segments: string[][] = [];
  const dots: { x: number; y: number }[] = [];
  let cur: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = points[i].line;
    if (v != null) {
      dots.push({ x: bCX(i), y: lY(v) });
      cur.push(`${bCX(i)},${lY(v)}`);
    } else {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) segments.push(cur);

  const hasLegend = barLabel || lineLabel;

  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} className="w-full">
      {/* left axis: line scale (tinted); gridlines come from this scale only */}
      <YGrid ticks={niceTicks(lineLo, lineHi)} yOf={lY} right={right} color={lineColor} />
      {/* right axis: bar scale (tinted labels, no second set of gridlines) */}
      {niceTicks(0, barMax)
        .filter((t) => t > 0)
        .map((t) => {
          const y = bY(t);
          if (y < 4 || y > H) return null;
          return (
            <text key={t} x={right + 4} y={Math.max(y + 2.5, 7)} fontSize="8" fill={barColor} opacity="0.8">
              {fmtTick(t)}
            </text>
          );
        })}
      {points.map((p, i) => (
        <rect key={i} x={bX(i)} y={bY(p.bar)} width={barW} height={bH(p.bar)} fill={barColor} opacity="0.5" />
      ))}
      {segments.map((seg, si) => (
        <polyline
          key={si}
          points={seg.join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {dots.map((d, di) => (
        <circle key={di} cx={d.x} cy={d.y} r="1.5" fill={lineColor} />
      ))}
      {xLabels && <XLabels labels={xLabels} xOf={threeSlotX(n, GL, right)} y={H + 12} />}
      {hasLegend && (
        <g transform={`translate(0,${H + 18})`}>
          {barLabel && (
            <>
              <rect x={GL} y="0" width="6" height="6" fill={barColor} opacity="0.65" rx="1" />
              <text x={GL + 9} y="6" className="fill-fg/40" fontSize="8">
                {barLabel}
              </text>
            </>
          )}
          {lineLabel && (
            <>
              <line x1={right - 10} y1="3" x2={right - 2} y2="3" stroke={lineColor} strokeWidth="1.5" />
              <text x={right - 13} y="6" textAnchor="end" className="fill-fg/40" fontSize="8">
                {lineLabel}
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}
