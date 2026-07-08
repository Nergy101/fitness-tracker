/**
 * Composable SVG chart primitives for the Apple Health Insights section.
 * Each component renders only the SVG — the caller provides the card wrapper.
 * Visual style matches SimpleChart.tsx (viewBox 300×120, fill-fg/30 labels).
 */

const W = 300;
const H = 100;
export const ACCENT = "#4cb782";

// ─── Normalisation helpers ────────────────────────────────────────────────────

function yN(v: number, lo: number, hi: number): number {
  return hi === lo ? H / 2 : H - ((v - lo) / (hi - lo)) * H;
}

function xN(v: number, lo: number, hi: number, size = W): number {
  return hi === lo ? size / 2 : ((v - lo) / (hi - lo)) * size;
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

  const slotW = W / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => i * slotW;
  const bCX = (i: number) => i * slotW + barW / 2;
  const bY = (v: number) => H - (v / yMax) * H;
  const bH = (v: number) => Math.max(0, (v / yMax) * H);
  const goalY = goalValue != null ? H - (goalValue / yMax) * H : null;

  const avgPts = overlay?.length
    ? overlay.map((p, i) => `${bCX(i)},${bY(p.y)}`).join(" ")
    : null;

  const lblIdxs = [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28">
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
          <line
            x1={0}
            y1={goalY}
            x2={W}
            y2={goalY}
            stroke={ACCENT}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.7"
          />
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
      {xLabels &&
        lblIdxs.map((idx, j) => (
          <text key={j} x={bCX(idx)} y={H + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
            {xLabels[j]}
          </text>
        ))}
      <text x="1" y="9" className="fill-fg/30" fontSize="9">
        {formatY ? formatY(dataMax) : dataMax.toFixed(0)}
      </text>
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

  const slotW = W / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => i * slotW;
  const bCX = (i: number) => i * slotW + barW / 2;
  const segH = (v: number) => Math.max(0, (v / yMax) * H);
  const goalY = goalValue != null ? H - (goalValue / yMax) * H : null;

  const lblIdxs = [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28">
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
          <line x1={0} y1={goalY} x2={W} y2={goalY} stroke={ACCENT} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          {goalLabel && (
            <text x={W - 2} y={goalY - 3} textAnchor="end" className="fill-fg/40" fontSize="8">
              {goalLabel}
            </text>
          )}
        </>
      )}
      {xLabels &&
        lblIdxs.map((idx, j) => (
          <text key={j} x={bCX(idx)} y={H + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
            {xLabels[j]}
          </text>
        ))}
      <text x="1" y="9" className="fill-fg/30" fontSize="9">
        {formatY ? formatY(dataMax) : dataMax.toFixed(0)}
      </text>
    </svg>
  );
}

// ─── ScatterChart ─────────────────────────────────────────────────────────────
// Actual x/y values mapped to chart space.
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

  const ptX = (x: number) => xN(x, xLo - xPad, xHi + xPad);
  const ptY = (y: number) => yN(y, yLo - yPad, yHi + yPad);

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28">
      {points.map((p, i) => (
        <circle key={i} cx={ptX(p.x)} cy={ptY(p.y)} r="3" fill={p.color ?? color} opacity="0.85" />
      ))}
      {xLabel && (
        <text x={W / 2} y={H + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
          {xLabel}
        </text>
      )}
      <text x="1" y="9" className="fill-fg/30" fontSize="9">
        {yHi.toFixed(1)}
      </text>
      <text x="1" y={H - 2} className="fill-fg/30" fontSize="9">
        {yLo.toFixed(1)}
      </text>
    </svg>
  );
}

// ─── BandChart ────────────────────────────────────────────────────────────────
// Shaded min–max band + avg centre line.

interface BandChartProps {
  points: BandPt[];
  color?: string;
}

export function BandChart({ points, color = ACCENT }: BandChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const allVals = points.flatMap((p) => [p.min, p.max, p.avg]);
  const lo = Math.min(...allVals);
  const hi = Math.max(...allVals);
  const pad = hi === lo ? 2 : (hi - lo) * 0.1;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const xOf = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yOf = (v: number) => yN(v, yLo, yHi);

  // Polygon: max edge left→right, min edge right→left
  const topEdge = points.map((p, i) => `${xOf(i)},${yOf(p.max)}`).join(" ");
  const botEdge = [...points].reverse().map((p, i) => `${xOf(n - 1 - i)},${yOf(p.min)}`).join(" ");

  const avgLine = points.map((p, i) => `${xOf(i)},${yOf(p.avg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28">
      <polygon points={`${topEdge} ${botEdge}`} fill={color} opacity="0.15" />
      <polyline
        points={avgLine}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="1" y="9" className="fill-fg/30" fontSize="9">
        {hi.toFixed(0)}
      </text>
      <text x="1" y={H - 2} className="fill-fg/30" fontSize="9">
        {lo.toFixed(0)}
      </text>
    </svg>
  );
}

// ─── DualAxisChart ────────────────────────────────────────────────────────────
// Bars on their own scale + line on independent scale.
// Line gaps (null) break the polyline into separate segments.
// Optional barLabel (left) and lineLabel (right) legend row.

interface DualAxisChartProps {
  points: DualPt[];
  barColor?: string;
  lineColor?: string;
  barLabel?: string;
  lineLabel?: string;
}

export function DualAxisChart({
  points,
  barColor = ACCENT,
  lineColor = "#38bdf8",
  barLabel,
  lineLabel,
}: DualAxisChartProps) {
  const n = points.length;
  if (n < 2) return null;

  const barVals = points.map((p) => p.bar);
  const lineVals = points.filter((p) => p.line != null).map((p) => p.line as number);
  const barMax = Math.max(...barVals) || 1;
  const lineLo = lineVals.length ? Math.min(...lineVals) : 0;
  const lineHi = lineVals.length ? Math.max(...lineVals) : 1;
  const linePad = lineHi === lineLo ? 2 : (lineHi - lineLo) * 0.15;

  const slotW = W / n;
  const barW = Math.max(1, slotW - 1);
  const bX = (i: number) => i * slotW;
  const bCX = (i: number) => i * slotW + barW / 2;
  const bY = (v: number) => H - (v / barMax) * H;
  const bH = (v: number) => Math.max(0, (v / barMax) * H);
  const lY = (v: number) => yN(v, lineLo - linePad, lineHi + linePad);

  // Collect contiguous non-null runs for the line; dots mark every point so
  // sparse series (e.g. weight logged every few days) stay visible even when
  // no run reaches the 2 points a polyline needs.
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
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-28">
      {points.map((p, i) => (
        <rect
          key={i}
          x={bX(i)}
          y={bY(p.bar)}
          width={barW}
          height={bH(p.bar)}
          fill={barColor}
          opacity="0.5"
        />
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
      {hasLegend && (
        <g transform={`translate(0,${H + 6})`}>
          {barLabel && (
            <>
              <rect x="0" y="0" width="6" height="6" fill={barColor} opacity="0.65" rx="1" />
              <text x="9" y="6" className="fill-fg/40" fontSize="8">
                {barLabel}
              </text>
            </>
          )}
          {lineLabel && (
            <>
              <line x1={W - 10} y1="3" x2={W - 2} y2="3" stroke={lineColor} strokeWidth="1.5" />
              <text x={W - 13} y="6" textAnchor="end" className="fill-fg/40" fontSize="8">
                {lineLabel}
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}
