import { CalendarBlankIcon as CalendarBlank } from "@phosphor-icons/react";
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
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="History date range">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onRangeChange(r.key)}
          aria-pressed={range === r.key && !calendar}
          className={`min-h-11 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            range === r.key && !calendar
              ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]"
              : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
          }`}
        >
          {r.label}
        </button>
      ))}
      <button
        onClick={onToggleCalendar}
        aria-pressed={calendar}
        className={`min-h-11 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
          calendar
            ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]"
            : "bg-surface text-fg/60 border border-fg/10 hover:text-fg"
        }`}
      >
        <CalendarBlank size={16} className="inline mr-1" />
        Calendar
      </button>
    </div>
  );
}
