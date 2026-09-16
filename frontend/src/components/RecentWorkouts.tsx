import { useEffect, useRef, useState } from "react";
import {
  PencilSimpleIcon as Pencil,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import Toast from "./Toast";
import {
  api,
  OfflineError,
  type BoxingEntryResponse,
  type CyclingEntryResponse,
  type RunEntryResponse,
} from "../api";
import {
  ACTIVITY_COLORS,
  ACTIVITY_ICONS,
  ACTIVITY_LABELS,
} from "../activity";
import { dayKey, todayKey } from "../dateKey";
import { useFocusTrap } from "../useFocusTrap";

/** The activity kinds that own a standalone entry (and therefore a Recent tag). */
export type RecentActivityKind = "run" | "walk" | "cycling" | "boxing";

/** Edit hand-off from a Recent tag to the logger that owns the entry's form. */
export type EditRequest =
  | { kind: "run" | "walk"; entry: RunEntryResponse }
  | { kind: "cycling"; entry: CyclingEntryResponse }
  | { kind: "boxing"; entry: BoxingEntryResponse };

interface RecentItemBase {
  key: string;
  id: number;
  date: string;
  /** Newest-first tiebreaker inside a day. */
  createdAt: string;
  /** Compact primary value for the tag: "5.2 km" / "45m". */
  primary: string;
  /** Second value shown in the action sheet. */
  secondary: string;
}

/** Discriminated so the edit hand-off narrows without casts. */
type RecentItem =
  | (RecentItemBase & { kind: "run" | "walk"; entry: RunEntryResponse })
  | (RecentItemBase & { kind: "cycling"; entry: CyclingEntryResponse })
  | (RecentItemBase & { kind: "boxing"; entry: BoxingEntryResponse });

interface RecentWorkoutsProps {
  onEdit: (req: EditRequest) => void;
  /** Bump to refetch (e.g. after logging). */
  refreshKey?: number;
  /** Called after a successful delete so the parent can refresh stats. */
  onChanged?: () => void;
  /** How many tags to show; the rest stay in History. */
  limit?: number;
}

/** "45m" / "1h 30m" — the tag needs to stay small, unlike formatDuration. */
function shortDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Local-calendar day label — never `new Date("YYYY-MM-DD")`, which is UTC. */
function dateLabel(iso: string): string {
  if (iso === todayKey()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === dayKey(yesterday)) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fullDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function deleteRecent(item: RecentItem): Promise<void> {
  switch (item.kind) {
    case "run":
    case "walk":
      return api.deleteRun(item.id);
    case "cycling":
      return api.deleteCycling(item.id);
    case "boxing":
      return api.deleteBoxing(item.id);
  }
}

/** Maps a tag back to the discriminant union TS can't infer from the property spread. */
function toEditRequest(item: RecentItem): EditRequest {
  switch (item.kind) {
    case "run":
    case "walk":
      return { kind: item.kind, entry: item.entry };
    case "cycling":
      return { kind: "cycling", entry: item.entry };
    case "boxing":
      return { kind: "boxing", entry: item.entry };
  }
}

/** Singular label for toasts/sheets: "Run", "Walk", "Cycling ride", "Boxing workout". */
function singularLabel(kind: RecentActivityKind): string {
  switch (kind) {
    case "run":
      return "Run";
    case "walk":
      return "Walk";
    case "cycling":
      return "Cycling ride";
    case "boxing":
      return "Boxing workout";
  }
}

/** Flattens runs/walks/cycling/boxing into one newest-first tag list. */
function collect(
  runs: RunEntryResponse[],
  cycling: CyclingEntryResponse[],
  boxing: BoxingEntryResponse[],
): RecentItem[] {
  const items: RecentItem[] = [];

  for (const entry of runs) {
    const kind: RecentActivityKind = entry.run_type === "walk" ? "walk" : "run";
    items.push({
      key: `${kind}-${entry.id}`,
      kind,
      id: entry.id,
      date: entry.date,
      createdAt: entry.created_at ?? "",
      primary: `${entry.distance_km.toFixed(1)} km`,
      secondary: `${shortDuration(entry.duration_seconds)} · ${entry.distance_km.toFixed(1)} km`,
      entry,
    });
  }

  for (const entry of cycling) {
    items.push({
      key: `cycling-${entry.id}`,
      kind: "cycling",
      id: entry.id,
      date: entry.date,
      createdAt: entry.created_at ?? "",
      primary: `${entry.distance_km.toFixed(1)} km`,
      secondary: `${shortDuration(entry.duration_seconds)} · ${entry.distance_km.toFixed(1)} km`,
      entry,
    });
  }

  for (const entry of boxing) {
    items.push({
      key: `boxing-${entry.id}`,
      kind: "boxing",
      id: entry.id,
      date: entry.date,
      createdAt: entry.created_at ?? "",
      primary: shortDuration(entry.duration_seconds),
      secondary: entry.rounds
        ? `${entry.rounds} rounds · ${entry.kcal_per_min} kcal/min`
        : `${entry.kcal_per_min} kcal/min`,
      entry,
    });
  }

  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/**
 * One combined, wrap-friendly row of recent-activity tags — replaces the four
 * stacked per-type lists that used to eat the top of the Workouts tab. Tapping a
 * tag opens its edit/delete actions.
 */
export default function RecentWorkouts({
  onEdit,
  refreshKey = 0,
  onChanged,
  limit = 14,
}: RecentWorkoutsProps) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [selected, setSelected] = useState<RecentItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getRuns().catch(() => [] as RunEntryResponse[]),
      api.getCycling().catch(() => [] as CyclingEntryResponse[]),
      api.getBoxing().catch(() => [] as BoxingEntryResponse[]),
    ]).then(([runs, cycling, boxing]) => {
      if (!cancelled) setItems(collect(runs, cycling, boxing));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(item: RecentItem) {
    const label = singularLabel(item.kind);
    setSelected(null);
    try {
      await deleteRecent(item);
      setItems((prev) => prev.filter((i) => i.key !== item.key));
      setToast(`${label} deleted`);
      onChanged?.();
    } catch (e) {
      setToast(
        e instanceof OfflineError
          ? `${label} delete queued for sync`
          : `Failed to delete ${label.toLowerCase()}`,
      );
    }
  }

  const shown = items.slice(0, limit);

  return (
    <>
      {toast && (
        <Toast onDismiss={() => setToast(null)}>{toast}</Toast>
      )}

      {shown.length > 0 && (
        <div className="mb-4 bg-surface rounded-xl p-3 border border-fg/10">
          <p className="text-xs font-semibold text-fg/50 mb-2">Recent workouts</p>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((item) => {
              const Icon = ACTIVITY_ICONS[item.kind];
              const color = ACTIVITY_COLORS[item.kind];
              const label = dateLabel(item.date);
              return (
                <button
                  key={item.key}
                  onClick={() => setSelected(item)}
                  aria-label={`${ACTIVITY_LABELS[item.kind]} ${label}: edit or delete`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-fg/10 bg-bg px-2.5 py-1 text-xs text-fg hover:border-accent/50 transition-colors"
                >
                  <Icon size={13} weight="bold" style={{ color }} />
                  <span className="font-semibold">{item.primary}</span>
                  <span className="text-fg/40">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <RecentActionSheet
          item={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            const item = selected;
            setSelected(null);
            onEdit(toEditRequest(item));
          }}
          onDelete={() => void handleDelete(selected)}
        />
      )}
    </>
  );
}

interface RecentActionSheetProps {
  item: RecentItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RecentActionSheet({
  item,
  onClose,
  onEdit,
  onDelete,
}: RecentActionSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, onClose);

  const Icon = ACTIVITY_ICONS[item.kind];
  const color = ACTIVITY_COLORS[item.kind];
  const label = singularLabel(item.kind);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} actions`}
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] border border-fg/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon size={18} weight="fill" style={{ color }} />
          <h2 className="text-base font-bold text-fg">{label}</h2>
          <span className="text-xs text-fg/40 ml-auto">
            {fullDateLabel(item.date)}
          </span>
        </div>

        {!confirming ? (
          <>
            <p className="text-sm text-fg/60 mb-5">{item.secondary}</p>
            <div className="flex gap-3">
              <button
                onClick={onEdit}
                className="flex-1 inline-flex items-center justify-center gap-1.5 border border-fg/15 text-fg/80 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-fg/5 transition-colors"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 border border-red-500/40 text-red-400 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-red-500/10 transition-colors"
              >
                <Trash size={14} />
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-fg/60 mb-5">
              Delete this {label.toLowerCase()}? This will also remove it from your
              history. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 border border-fg/15 text-fg/70 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-fg/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="flex-1 bg-red-500 text-on-accent rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
