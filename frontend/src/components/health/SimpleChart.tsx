import { useId } from "react";
import { type WeightEntryResponse } from "../../api";
import { shortDate } from "./utils";
import { smoothAreaPath, smoothLinePath } from "./chartPath";

const WEIGHT_COLOR = "var(--tint-walk-fg)";

/** SVG trend chart of the last 30 weight entries — a Catmull-Rom smoothed
 *  curve with a gradient area fill, matching the Weight Journey chart style
 *  in StatsTab's LineChart. */
export default function SimpleChart({ entries }: { entries: WeightEntryResponse[] }) {
  const gradId = useId();
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-30);
  if (recent.length < 2) return null;

  const values = recent.map((e) => e.weight_kg);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min;
  const w = 300;
  const h = 100;
  const labels = [recent[0], recent[Math.floor(recent.length / 2)], recent[recent.length - 1]];

  const px = (i: number) => (i / (recent.length - 1)) * w;
  const py = (weightKg: number) => h - ((weightKg - min) / range) * h;
  const pixelPts = recent.map((e, i) => ({ x: px(i), y: py(e.weight_kg) }));
  const linePath = smoothLinePath(pixelPts);
  const areaPath = smoothAreaPath(pixelPts, h);

  return (
    <div className="bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)]">
      <p className="text-[10px] font-semibold tracking-wide text-fg/45 mb-3">Weight Trend (30d)</p>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WEIGHT_COLOR} stopOpacity="0.28" />
            <stop offset="100%" stopColor={WEIGHT_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path data-chart="area" d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path
          data-chart="line"
          d={linePath}
          fill="none"
          stroke={WEIGHT_COLOR}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {recent.map((e, i) => (
          <circle key={e.id} cx={px(i)} cy={py(e.weight_kg)} r="2.5" fill={WEIGHT_COLOR} />
        ))}
        {labels.map((e, i) => {
          const idx = recent.indexOf(e);
          if (idx < 0) return null;
          return (
            <text key={i} x={px(idx)} y={h + 14} textAnchor="middle" className="fill-fg/35" fontSize="9" fontWeight="600">
              {shortDate(e.date)}
            </text>
          );
        })}
        <text x="0" y="10" className="fill-fg/35" fontSize="9" fontWeight="600">{max.toFixed(1)}</text>
        <text x="0" y={h - 4} className="fill-fg/35" fontSize="9" fontWeight="600">{min.toFixed(1)}</text>
      </svg>
    </div>
  );
}
