import { type WeightEntryResponse } from "../../api";
import { shortDate } from "./utils";

/** Simple SVG line chart of the last 30 weight entries. */
export default function SimpleChart({ entries }: { entries: WeightEntryResponse[] }) {
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

  const points = recent.map((e, i) => {
    const x = (i / (recent.length - 1)) * w;
    const y = h - ((e.weight_kg - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      <p className="text-xs text-fg/40 mb-3">Weight Trend (30d)</p>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-28">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="#4cb782"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {recent.map((e, i) => {
          const x = (i / (recent.length - 1)) * w;
          const y = h - ((e.weight_kg - min) / range) * h;
          return <circle key={e.id} cx={x} cy={y} r="2.5" fill="#4cb782" />;
        })}
        {labels.map((e, i) => {
          const idx = recent.indexOf(e);
          if (idx < 0) return null;
          const x = (idx / (recent.length - 1)) * w;
          return (
            <text key={i} x={x} y={h + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
              {shortDate(e.date)}
            </text>
          );
        })}
        <text x="0" y="10" className="fill-fg/30" fontSize="9">{max.toFixed(1)}</text>
        <text x="0" y={h - 4} className="fill-fg/30" fontSize="9">{min.toFixed(1)}</text>
      </svg>
    </div>
  );
}
