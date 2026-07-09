import type { WorkoutSession } from "../../api";
import SessionCard from "./SessionCard";

/** Renders a list of session rows, or an empty-state message. */
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
  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 text-fg/30 text-sm">{emptyLabel}</div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onSelect={onSelect}
          onEditDate={onEditDate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
