import { ACTIVITY_COLORS, ACTIVITY_LABELS, type ActivityKind } from "../activity";

/** Color-dot legend for charts that stack workout/run/walk series. */
export default function ActivityLegend({ kinds }: { kinds: ActivityKind[] }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      {kinds.map((kind) => (
        <span key={kind} className="flex items-center gap-1 text-[10px] text-fg/40">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: ACTIVITY_COLORS[kind] }}
          />
          {ACTIVITY_LABELS[kind]}
        </span>
      ))}
    </div>
  );
}
