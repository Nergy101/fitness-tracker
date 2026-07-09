/** Axis tick math shared by the chart primitives. */

/** 2–3 round tick values inside [lo, hi] (step = 1/2/2.5/5 × 10^k). */
export function niceTicks(lo: number, hi: number, target = 3): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const rawStep = span / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(6)));
  }
  return ticks;
}

/** Compact tick label: 12000 → "12k", 1500 → "1.5k", 7.25 → "7.3". */
export function fmtTick(v: number): string {
  if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.abs(v) < 10 && v % 1 !== 0 ? v.toFixed(1) : v.toFixed(0);
}
