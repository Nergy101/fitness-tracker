import { Calendar as CalendarBlank } from "reicon-react";
import { RANGES, type RangeKey } from "./utils";

/** "This week / 7 Days / 30 Days" pills plus the calendar toggle. */
export default function DateRangeFilter({
  range,
  calendar,
  onRangeChange,
  onToggleCalendar,
}: {
  range: RangeKey;
  calendar: boolean;
  onRangeChange: (key: RangeKey) => void;
  onToggleCalendar: () => void;
}) {
  return (
    <div className="flex gap-2 mb-4">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onRangeChange(r.key)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            range === r.key && !calendar
              ? "bg-accent text-on-accent"
              : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
          }`}
        >
          {r.label}
        </button>
      ))}
      <button
        onClick={onToggleCalendar}
        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          calendar
            ? "bg-accent text-on-accent"
            : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
        }`}
      >
        <CalendarBlank size={16} className="inline mr-1" />
        Calendar
      </button>
    </div>
  );
}
