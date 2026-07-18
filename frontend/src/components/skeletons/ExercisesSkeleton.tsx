import Skeleton from "../Skeleton";

/** Search bar + category filter pills + 6 placeholder exercise rows.
 *  Matches the ExercisesTab content layout. */
export default function ExercisesSkeleton() {
  return (
    <div className="exercises-tab" aria-label="Loading exercises" role="status">
      {/* Search bar + Add button */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="100%" height="40px" rounded="xl" className="flex-1" />
        <Skeleton width="72px" height="40px" rounded="xl" className="ml-3 shrink-0" />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} width={`${64 + i * 10}px`} height="28px" rounded="full" />
        ))}
      </div>

      {/* 6 Exercise row placeholders */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl p-3 border border-fg/5 flex items-center gap-3"
          >
            <Skeleton width="56px" height="56px" rounded="lg" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton width={`${100 + i * 15}px`} height="14px" rounded="md" />
                <Skeleton width="56px" height="20px" rounded="full" />
              </div>
              <div className="flex gap-3">
                <Skeleton width="40px" height="12px" rounded="md" />
                <Skeleton width="70px" height="12px" rounded="md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
