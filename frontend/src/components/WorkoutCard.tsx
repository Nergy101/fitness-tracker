import { TrashIcon as Trash, PushPinIcon as PushPin, CopyIcon as Copy } from "@phosphor-icons/react";
import { type WorkoutTemplate } from "../api";
import { formatDuration } from "../format";
import { useEffect, useRef } from "react";

interface WorkoutCardProps {
  template: WorkoutTemplate;
  onStart: (tpl: WorkoutTemplate) => void;
  onEdit: (tpl: WorkoutTemplate) => void;
  onClone: (tpl: WorkoutTemplate) => void;
  onDelete: (id: number, name: string) => void;
  onLog: (tpl: WorkoutTemplate) => void;
  onTogglePin: (tpl: WorkoutTemplate) => void;
  highlightId?: number | null;
}

export default function WorkoutCard({
  template,
  onStart,
  onEdit,
  onClone,
  onDelete,
  onLog,
  onTogglePin,
  highlightId,
}: WorkoutCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlightId === template.id;

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  return (
    <div
      ref={cardRef}
      data-testid="workout-card"
      className={`bg-surface rounded-2xl p-4 border shadow-[var(--shadow-sm)] transition-all duration-500 ${
        isHighlighted
          ? "border-accent shadow-[0_0_12px_rgba(var(--color-accent-rgb,99,102,241),0.3)]"
          : template.is_pinned
            ? "border-accent/30 shadow-[0_0_0_1px_rgba(var(--color-accent-rgb,99,102,241),0.15)]"
            : "border-fg/[0.06]"
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(template);
          }}
          className={`shrink-0 -ml-2 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
            template.is_pinned
              ? "text-accent hover:bg-accent/10"
              : "text-fg/25 hover:bg-fg/5 hover:text-fg/50"
          }`}
          title={template.is_pinned ? "Unpin workout" : "Pin workout"}
          aria-label={template.is_pinned ? "Unpin workout" : "Pin workout"}
        >
          <PushPin
            size={18}
            weight={template.is_pinned ? "fill" : "regular"}
          />
        </button>

        <div
          className="flex-1 cursor-pointer min-w-0"
          onClick={() => onStart(template)}
        >
          <h3 className="font-semibold text-base truncate">{template.name}</h3>
          {template.mode && template.mode !== "circuit" && (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-accent/15 text-accent mt-0.5">
              {template.mode}
            </span>
          )}
        </div>
      </div>

      {/* Full-width description */}
      {template.description && (
        <p className="text-fg/50 text-sm mt-1">{template.description}</p>
      )}

      {/* Full-width metadata */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-fg/40">
        <span>{template.exercises.length} exercises</span>
        {template.exercises.some((e) => e.superset_group != null) && (
          <span className="text-accent/60">superset</span>
        )}
        {template.rounds > 1 && <span>{template.rounds} rounds</span>}
      </div>
      {(template.warmup_seconds > 0 || template.cooldown_seconds > 0) && (
        <div className="grid grid-cols-2 gap-x-3 mt-1.5 text-xs">
          {template.warmup_seconds > 0 ? (
            <span className="text-orange-400/70">
              🔥 Warmup{" "}
              <span className="font-semibold">
                {formatDuration(template.warmup_seconds)}
              </span>
            </span>
          ) : (
            <span />
          )}
          {template.cooldown_seconds > 0 ? (
            <span className="text-blue-400/70">
              🧊 Cooldown{" "}
              <span className="font-semibold">
                {formatDuration(template.cooldown_seconds)}
              </span>
            </span>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Timing stat chip */}
      <div className="grid grid-cols-3 gap-x-3 mt-2 bg-surface-2 rounded-xl px-3 py-2 text-xs">
        <span className="text-fg/50">
          Work{" "}
          <span className="font-semibold text-fg/70 tabular-nums">
            {formatDuration(template.work_duration_seconds)}
          </span>
        </span>
        {template.rest_duration_seconds > 0 ? (
          <span className="text-fg/50">
            Rest{" "}
            <span className="font-semibold text-fg/70 tabular-nums">
              {template.rounds - 1}&times;
              {formatDuration(template.rest_between_rounds)}
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="text-accent">
          Total{" "}
          <span className="font-semibold tabular-nums">
            {formatDuration(template.total_duration_seconds)}
          </span>
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-fg/[0.06]">
        <div className="flex items-center gap-1 -ml-2">
          <button
            onClick={() => onEdit(template)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-fg/40 hover:bg-fg/5 hover:text-fg/70 transition-colors"
            title="Edit"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            onClick={() => onClone(template)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-fg/40 hover:bg-fg/5 hover:text-fg/70 transition-colors"
            title="Duplicate"
            aria-label="Duplicate workout"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={() => onDelete(template.id, template.name)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-red-400/50 hover:bg-red-400/10 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onLog(template)}
            disabled={template.exercises.length === 0}
            className="h-10 px-4 border border-fg/10 rounded-xl text-fg/70 text-sm font-semibold hover:bg-fg/5 active:bg-fg/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={template.exercises.length === 0 ? "Add exercises to start" : "Log this workout as completed"}
          >
            Log
          </button>
          <button
            onClick={() => onStart(template)}
            disabled={template.exercises.length === 0}
            className="h-10 px-4 bg-accent text-on-accent rounded-xl text-sm font-semibold shadow-[var(--shadow-sm)] active:scale-[0.98] transition disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            title={template.exercises.length === 0 ? "Add exercises to start" : undefined}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
