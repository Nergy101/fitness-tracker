import { TrashIcon as Trash, PushPinIcon as PushPin, CopyIcon as Copy } from "@phosphor-icons/react";
import { type WorkoutTemplate } from "../api";
import { formatDuration } from "../format";

interface WorkoutCardProps {
  template: WorkoutTemplate;
  onStart: (tpl: WorkoutTemplate) => void;
  onEdit: (tpl: WorkoutTemplate) => void;
  onClone: (tpl: WorkoutTemplate) => void;
  onDelete: (id: number, name: string) => void;
  onLog: (tpl: WorkoutTemplate) => void;
  onTogglePin: (tpl: WorkoutTemplate) => void;
}

export default function WorkoutCard({
  template,
  onStart,
  onEdit,
  onClone,
  onDelete,
  onLog,
  onTogglePin,
}: WorkoutCardProps) {
  return (
    <div
      className={`bg-surface rounded-xl p-4 border transition-colors ${
        template.is_pinned
          ? "border-accent/30 shadow-[0_0_0_1px_rgba(var(--color-accent-rgb,99,102,241),0.15)]"
          : "border-fg/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          {/* Pin / star icon */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(template);
            }}
            className={`shrink-0 mt-0.5 p-0.5 rounded transition-colors ${
              template.is_pinned
                ? "text-accent hover:text-accent/70"
                : "text-fg/15 hover:text-fg/40"
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
            className="flex-1 cursor-pointer"
            onClick={() => onStart(template)}
          >
            <h3 className="font-semibold text-base">{template.name}</h3>
            {template.mode && template.mode !== "circuit" && (
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent ml-2 align-middle">
                {template.mode}
              </span>
            )}
            {template.description && (
              <p className="text-fg/50 text-sm mt-1">{template.description}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-fg/40">
              <span>{template.exercises.length} exercises</span>
              {template.exercises.some((e) => e.superset_group != null) && (
                <span className="text-accent/60">superset</span>
              )}
              {template.rounds > 1 && <span>{template.rounds} rounds</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5 text-xs">
              <span className="text-fg/50">
                Work{" "}
                <span className="font-semibold text-fg/70">
                  {formatDuration(template.work_duration_seconds)}
                </span>
              </span>
              {template.rest_duration_seconds > 0 ? (
                <span className="text-fg/50">
                  Rest{" "}
                  <span className="font-semibold text-fg/70">
                    {template.rounds - 1}&times;
                    {formatDuration(template.rest_between_rounds)}
                  </span>
                </span>
              ) : (
                <span />
              )}
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
            <div className="mt-1 text-xs">
              <span className="text-accent">
                Total{" "}
                <span className="font-semibold">
                  {formatDuration(template.total_duration_seconds)}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 ml-3">
          <button
            onClick={() => onEdit(template)}
            className="text-fg/30 hover:text-fg/70 transition-colors p-1"
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
            className="text-fg/30 hover:text-fg/70 transition-colors p-1"
            title="Duplicate"
            aria-label="Duplicate workout"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={() => onDelete(template.id, template.name)}
            className="text-red-400/40 hover:text-red-400 transition-colors p-1"
            title="Delete"
          >
            <Trash size={18} />
          </button>
          <button
            onClick={() => onLog(template)}
            className="border border-fg/20 text-fg/60 rounded-xl px-3 py-1.5 text-xs font-semibold hover:border-accent/40 hover:text-accent transition-colors"
            title="Log this workout as completed"
          >
            Log
          </button>
          <button
            onClick={() => onStart(template)}
            className="bg-accent/20 text-accent rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-accent/30 transition-colors"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
