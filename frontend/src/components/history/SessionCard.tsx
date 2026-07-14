import { useState } from "react";
import { Edit2 as PencilSimple, Trash as Trash } from "reicon-react";
import { api, type WorkoutSession } from "../../api";
import { formatDate, formatDuration, localISO } from "../../format";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, activityKind } from "../../activity";

/** A single session row with inline date/time editing. */
export default function SessionCard({
  session,
  onSelect,
  onEditDate,
  onDelete,
}: {
  session: WorkoutSession;
  onSelect: (s: WorkoutSession) => void;
  onEditDate: (s: WorkoutSession) => void;
  onDelete: (s: WorkoutSession) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const kind = activityKind(session.template_name);
  const KindIcon = ACTIVITY_ICONS[kind];

  return (
    <div
      className="bg-surface rounded-xl p-4 border border-fg/5 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={() => onSelect(session)}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KindIcon size={16} className="shrink-0" style={{ color: ACTIVITY_COLORS[kind] }} />
            <h3 className="font-semibold text-sm">{session.template_name}</h3>
          </div>
          {editing ? (
            <input
              type="datetime-local"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                api.updateSession(session.id, { started_at: localISO(editValue) }).then((updated) => {
                  onEditDate(updated);
                }).catch(() => {});
                setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditing(false);
              }}
              className="text-xs bg-bg border border-accent/30 rounded-lg px-2 py-1 mt-0.5 w-48 text-fg outline-none"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-fg/40 mt-0.5">
                {formatDate(session.started_at)}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const d = new Date(session.started_at);
                  setEditValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                  setEditing(true);
                }}
                className="text-fg/20 hover:text-accent mt-0.5"
                title="Edit date/time"
              >
                <PencilSimple size={12} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg/30">
            ~{Math.round(session.total_kcal_estimated)} kcal
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session);
            }}
            className="text-fg/20 hover:text-red-400 transition-colors"
            title="Delete session"
            aria-label="Delete session"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-fg/50">
        <span>{formatDuration(session.total_duration_seconds)}</span>
        <span>{session.exercises.length} exercises</span>
      </div>
    </div>
  );
}
