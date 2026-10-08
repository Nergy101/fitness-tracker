/**
 * Composable SVG chart primitives for the Apple Health charts.
 * Each component renders only the SVG — the caller provides the card wrapper.
 *
 * Shared axis conventions (matching the Stats tab's weekly chart):
 *   - left gutter with 2–3 "nice" y ticks, dashed fg/10 gridlines
 *   - three x-axis date labels (first / middle / last) via `xLabels`
 *   - dual-axis charts tint each side's tick labels in its series color
 *
 * Visual language: bars are single-series (never stacked) so a top `rx`
 * rounds cleanly with no notch risk; trend lines (band/dual-axis) render as
 * smoothed Catmull-Rom paths via `chartPath` with a soft gradient fill under
 * them. Element *types* (rect vs path, polyline vs path) are pinned by
 * insightCharts.test.tsx where a test depends on them — see that file.
 */

import { useId, useState } from "react";
import { fmtTick, niceTicks, ticksByStep } from "./ticks";
import { smoothLinePath } from "./chartPath";
import ChartPoint from "../ChartPoint";

const W = 300;
const H = 140;
const GL = 30; // left gutter: y-axis tick labels
export const ACCENT = "var(--accent)";

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
            <line x1={GL} y1={y} x2={right} y2={y} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
            <text
              x={GL - 4}
              y={Math.max(y + 2.5, 7)}
              textAnchor="end"
              fontSize="8"
              fontWeight="600"
              {...(color ? { fill: color, opacity: 0.8 } : { className: "fill-fg/35" })}
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
        <text key={j} x={xOf(j)} y={y} textAnchor="middle" className="fill-fg/40" fontSize="9" fontWeight="500">
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
export type BPt = { x: number; y: number; color?: string; label?: string };
export type SPt = { x: number; y: number; color?: string; label?: string };
export type BandPt = { x: number; avg: number; min: number; max: number; label?: string };
export type DualPt = { x: number; bar: number; line: number | null; label?: string }

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const gradId = useId();
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
  const barRadius = Math.min(3, barW / 2);

  const avgPts = overlay?.length
    ? overlay.map((p, i) => `${bCX(i)},${bY(p.y)}`).join(" ")
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={defaultColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={defaultColor} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <YGrid ticks={niceTicks(0, yMax).filter((t) => t > 0)} yOf={bY} format={formatY ?? fmtTick} />
      {points.map((p, i) => (
        <g key={i}>
          <rect
            x={bX(i)}
            y={bY(p.y)}
            width={barW}
            height={bH(p.y)}
            rx={barRadius}
            fill={p.color ?? `url(#${gradId})`}
          />
          <ChartPoint x={bCX(i)} y={Math.max(4, bY(p.y))} value={formatY?.(p.y) ?? fmtTick(p.y)} label={String(i + 1)} color={p.color ?? defaultColor} selected={selectedIndex === i} onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)} chartWidth={W} radius={0} />
        </g>
      ))}
      {goalY != null && (
        <>
          <line x1={GL} y1={goalY} x2={W} y2={goalY} stroke={ACCENT} strokeWidth="1.25" strokeDasharray="4 3" strokeLinecap="round" opacity="0.7" />
          {goalLabel && (
            <text x={W - 2} y={goalY - 3} textAnchor="end" className="fill-fg/40" fontSize="8" fontWeight="600">
              {goalLabel}
            </text>
          )}
        </>
      )}
      {avgPts && (
        <polyline
          points={avgPts}
          fill="none"
          stroke="rgba(255,255,255,0.8)"
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
// Segments stay plain (non-rounded) rects — rounding only the top one would
// need a path, and stacks aren't worth the extra element-type complexity here
// (see StatsTab's StackedBarChart for the path-based top-rounding pattern,
// used where a stack is the primary chart rather than a secondary one).

export type StackSeg = { value: number; color: string };
export type StkPt = { x: number; segments: StackSeg[]; label?: string };

interface DailyStackedBarChartProps {
  points: StkPt[];
  goalValue?: number;
  goalLabel?: string;
  formatY?: (v: number) => string;
  xLabels?: [string, string, string];
}
export function DailyStackedBarChart({ points, goalValue, goalLabel, formatY, xLabels }: DailyStackedBarChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full overflow-visible">
      {points.map((p, i) => {
        let y = H;
        const total = p.segments.reduce((sum, segment) => sum + segment.value, 0);
        const rects = p.segments.map((seg, si) => {
          const h = segH(seg.value);
          y -= h;
          return <rect key={`${i}-${si}`} x={bX(i)} y={y} width={barW} height={h} fill={seg.color} opacity="0.88" />;
        });
        return (
          <g key={i}>
            {rects}
            <ChartPoint x={bX(i) + barW / 2} y={Math.max(4, yOf(total))} value={formatY?.(total) ?? fmtTick(total)} label={p.label ?? `Point ${i + 1}`} color={p.segments.at(-1)?.color ?? ACCENT} selected={selectedIndex === i} onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)} chartWidth={W} radius={0} />
          </g>
        );
      })}
      {goalY != null && (
        <>
          <line x1={GL} y1={goalY} x2={W} y2={goalY} stroke={ACCENT} strokeWidth="1.25" strokeDasharray="4 3" strokeLinecap="round" opacity="0.7" />
          {goalLabel && (
            <text x={W - 2} y={goalY - 3} textAnchor="end" className="fill-fg/40" fontSize="8" fontWeight="600">
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
  /** Fixed x-axis tick interval (e.g. 10 = every 10 min). Falls back to niceTicks when omitted. */
  xStep?: number;
}

export function ScatterChart({ points, color = ACCENT, xLabel, xStep }: ScatterChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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

  const xTicks = xStep
    ? ticksByStep(xLo, xHi, xStep)
    : niceTicks(xLo, xHi);

  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full overflow-visible">
      <YGrid ticks={niceTicks(yLo, yHi)} yOf={ptY} />
      {xTicks.map((t) => (
        <g key={t}>
          <line x1={ptX(t)} y1={0} x2={ptX(t)} y2={H} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
          <text x={ptX(t)} y={H + 9} textAnchor="middle" className="fill-fg/35" fontSize="8" fontWeight="600">
            {fmtTick(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <ChartPoint key={i} x={ptX(p.x)} y={ptY(p.y)} value={`x ${fmtTick(p.x)} · y ${fmtTick(p.y)}`} label={p.label ?? `Point ${i + 1}`} color={p.color ?? color} selected={selectedIndex === i} onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)} chartWidth={W} />
      ))}
      {xLabel && (
        <text x={GL + (W - GL) / 2} y={H + 22} textAnchor="middle" className="fill-fg/40" fontSize="9" fontWeight="500">
          {xLabel}
        </text>
      )}
    </svg>
  );
}

// ─── BandChart ────────────────────────────────────────────────────────────────
// Shaded min–max band + smoothed avg centre line, both rendered as paths so
// the trend reads as a curve rather than straight segments between samples.

interface BandChartProps {
  points: BandPt[];
  color?: string;
  xLabels?: [string, string, string];
  /** Dashed category reference lines (e.g. HR zone thresholds). */
  references?: { value: number; label: string }[];
}

export function BandChart({ points, color = ACCENT, xLabels, references }: BandChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const n = points.length;
  if (n < 2) return null;

  const refVals = (references ?? []).map((r) => r.value);
  const allVals = points.flatMap((p) => [p.min, p.max, p.avg]);
  const lo = Math.min(...allVals, ...refVals);
  const hi = Math.max(...allVals, ...refVals);
  const pad = hi === lo ? 2 : (hi - lo) * 0.1;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const xOf = (i: number) => GL + (n === 1 ? (W - GL) / 2 : (i / (n - 1)) * (W - GL));
  const yOf = (v: number) => yN(v, yLo, yHi);

  const topPts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.max) }));
  const botPts = [...points].reverse().map((p, i) => ({ x: xOf(n - 1 - i), y: yOf(p.min) }));
  const bandPath = `${smoothLinePath(topPts)} L ${smoothLinePath(botPts).slice(2)} Z`;
  const avgPts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.avg) }));
  const avgPath = smoothLinePath(avgPts);

  const lblIdxs = [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full overflow-visible">
      <YGrid ticks={niceTicks(yLo, yHi)} yOf={yOf} />
      {(references ?? []).map((r) => (
        <g key={r.value}>
          <line x1={GL} y1={yOf(r.value)} x2={W} y2={yOf(r.value)} stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.35" />
          <text x={W - 2} y={yOf(r.value) - 3} textAnchor="end" className="fill-fg/40" fontSize="8">
            {r.label}
          </text>
        </g>
      ))}
      <path data-chart="band-area" d={bandPath} fill={color} opacity="0.16" stroke="none" />
      <path
        data-chart="band-line"
        d={avgPath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, i) => (
        <ChartPoint key={i} x={xOf(i)} y={yOf(point.avg)} value={`avg ${fmtTick(point.avg)} · min ${fmtTick(point.min)} · max ${fmtTick(point.max)}`} label={point.label ?? `Point ${i + 1}`} color={color} selected={selectedIndex === i} onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)} chartWidth={W} />
      ))}
      {xLabels && <XLabels labels={xLabels} xOf={(j) => xOf(lblIdxs[j])} />}
    </svg>
  );
}

// ─── DualAxisChart ────────────────────────────────────────────────────────────
// Bars on the RIGHT axis scale + line on the LEFT axis scale; each side's tick
// labels are tinted in its series color so the two scales read unambiguously.
// Line gaps (null) break the smoothed path into separate segments; dots mark
// every point so sparse series stay visible.

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
  lineColor = "var(--tint-blue-bar)",
  barLabel,
  lineLabel,
  xLabels,
}: DualAxisChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const gradId = useId();
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
  const barRadius = Math.min(2.5, barW / 2);

  const segments: { x: number; y: number }[][] = [];
  const dots: { x: number; y: number }[] = [];
  let cur: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = points[i].line;
    if (v != null) {
      dots.push({ x: bCX(i), y: lY(v) });
      cur.push({ x: bCX(i), y: lY(v) });
    } else {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) segments.push(cur);

  const hasLegend = barLabel || lineLabel;
  const labelIndices = [0, Math.floor((n - 1) / 2), n - 1];
  const pointLabel = (point: DualPt, index: number) => point.label ?? (
    xLabels && labelIndices.includes(index) ? xLabels[labelIndices.indexOf(index)] : `Point ${index + 1}`
  );

  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} className="w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={barColor} stopOpacity={0.6} />
          <stop offset="100%" stopColor={barColor} stopOpacity={0.22} />
        </linearGradient>
      </defs>
      {/* left axis: line scale (tinted); gridlines come from this scale only */}
      <YGrid ticks={niceTicks(lineLo, lineHi)} yOf={lY} right={right} color={lineColor} />
      {/* right axis: bar scale (tinted labels, no second set of gridlines) */}
      {niceTicks(0, barMax)
        .filter((t) => t > 0)
        .map((t) => {
          const y = bY(t);
          if (y < 4 || y > H) return null;
          return (
            <text key={t} x={right + 4} y={Math.max(y + 2.5, 7)} fontSize="8" fontWeight="600" fill={barColor} opacity="0.8">
              {fmtTick(t)}
            </text>
          );
        })}
      {points.map((p, i) => (
        <rect key={i} x={bX(i)} y={bY(p.bar)} width={barW} height={bH(p.bar)} rx={barRadius} fill={`url(#${gradId})`} />
      ))}
      {segments.map((seg, si) => (
        <path
          key={si}
          d={smoothLinePath(seg)}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {points.map((point, index) => point.line == null ? null : (
        <ChartPoint key={`chart-point-${index}`} x={bCX(index)} y={lY(point.line)} value={`${lineLabel ?? "Line"}: ${fmtTick(point.line)} · ${barLabel ?? "Bar"}: ${fmtTick(point.bar)}`} label={pointLabel(point, index)} color={lineColor} selected={selectedIndex === index} onSelect={() => setSelectedIndex(selectedIndex === index ? null : index)} chartWidth={W} radius={1.5} />
      ))}
      {hasLegend && (
        <g transform={`translate(0,${H + 18})`}>
          {barLabel && (
            <>
              <rect x={GL} y="0" width="6" height="6" fill={barColor} opacity="0.65" rx="1.5" />
              <text x={GL + 9} y="6" className="fill-fg/40" fontSize="8" fontWeight="500">
                {barLabel}
              </text>
            </>
          )}
          {lineLabel && (
            <>
              <line x1={right - 10} y1="3" x2={right - 2} y2="3" stroke={lineColor} strokeWidth="2" strokeLinecap="round" />
              <text x={right - 13} y="6" textAnchor="end" className="fill-fg/40" fontSize="8" fontWeight="500">
                {lineLabel}
              </text>
            </>
          )}
        </g>
      )}
      {xLabels && <XLabels labels={xLabels} xOf={threeSlotX(n, GL, right)} y={H + 12} />}
    </svg>
  );
}
