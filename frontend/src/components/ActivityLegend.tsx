import { ACTIVITY_COLORS, ACTIVITY_LABELS, type ActivityKind } from "../activity";

/** Color-dot legend for charts that stack workout/run/walk series. */
export default function ActivityLegend({ kinds }: { kinds: ActivityKind[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
      {kinds.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5 text-[10px] font-medium text-fg/45">
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
