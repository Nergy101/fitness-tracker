import Skeleton from "../Skeleton";

/** Compact WorkoutCard placeholders — intentionally simpler than real cards
 *  to fit cleanly without overflow during loading. */
export default function WorkoutSkeleton() {
  return (
    <div aria-label="Loading workouts" role="status">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-xl p-4 border border-fg/5 space-y-2.5 mb-3"
        >
          {/* Title + actions */}
          <div className="flex items-center justify-between">
            <Skeleton width={`${120 + i * 24}px`} height="16px" rounded="md" />
            <div className="flex gap-2">
              <Skeleton width="28px" height="28px" rounded="md" />
              <Skeleton width="48px" height="28px" rounded="xl" />
              <Skeleton width="52px" height="28px" rounded="xl" />
            </div>
          </div>
          {/* Work / Rest / Total */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton width="100%" height="10px" rounded="md" />
            <Skeleton width="100%" height="10px" rounded="md" />
            <Skeleton width="100%" height="10px" rounded="md" />
          </div>
        </div>
      ))}
    </div>
  );
}
