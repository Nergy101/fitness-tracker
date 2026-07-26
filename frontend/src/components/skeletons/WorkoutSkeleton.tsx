import Skeleton from "../Skeleton";

/** WorkoutCard placeholders matching the real card layout:
 *  pin icon · title bar · action buttons
 *  metadata row · warmup/cooldown · work/rest/total */
export default function WorkoutSkeleton() {
  return (
    <div className="workout-tab" aria-label="Loading workouts" role="status">
      {/* 3 WorkoutCard placeholders */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3 mb-3"
        >
          {/* Title row: pin + title + buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton width="18px" height="18px" rounded="md" />
              <Skeleton width={`${140 + i * 20}px`} height="18px" rounded="md" />
            </div>
            <div className="flex gap-2">
              <Skeleton width="28px" height="28px" rounded="md" />
              <Skeleton width="28px" height="28px" rounded="md" />
              <Skeleton width="28px" height="28px" rounded="md" />
              <Skeleton width="48px" height="28px" rounded="xl" />
              <Skeleton width="52px" height="28px" rounded="xl" />
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex gap-3">
            <Skeleton width="90px" height="12px" rounded="md" />
            <Skeleton width="60px" height="12px" rounded="md" />
          </div>

          {/* Warmup / cooldown */}
          <div className="grid grid-cols-2 gap-3">
            <Skeleton width="100%" height="12px" rounded="md" />
            <Skeleton width="100%" height="12px" rounded="md" />
          </div>

          {/* Work / Rest / Total */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton width="100%" height="12px" rounded="md" />
            <Skeleton width="100%" height="12px" rounded="md" />
            <Skeleton width="100%" height="12px" rounded="md" />
          </div>
        </div>
      ))}
    </div>
  );
}
