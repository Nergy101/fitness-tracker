import { useState } from "react";
import type { WorkoutSession } from "../../api";
import SessionCard from "./SessionCard";

const PAGE_SIZE = 50;

/** Renders a list of session rows, or an empty-state message. Long lists are
 *  paginated client-side: the first PAGE_SIZE render immediately, a "Load
 *  more" button reveals the rest (NER-230). */
export default function SessionList({
  sessions,
  onSelect,
  onEditDate,
  onDelete,
  emptyLabel,
}: {
  sessions: WorkoutSession[];
  onSelect: (s: WorkoutSession) => void;
  onEditDate: (s: WorkoutSession) => void;
  onDelete: (s: WorkoutSession) => void;
  emptyLabel: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 text-fg/30 text-sm">{emptyLabel}</div>
    );
  }

  const shown = sessions.slice(0, visible);
  const hasMore = sessions.length > visible;

  return (
    <div className="space-y-2">
      {shown.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onSelect={onSelect}
          onEditDate={onEditDate}
          onDelete={onDelete}
        />
      ))}
      {hasMore && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors"
          aria-label="Load more sessions"
        >
          Load more
          <span className="text-xs text-fg/30">
            ({sessions.length - visible} remaining)
          </span>
        </button>
      )}
    </div>
  );
}
