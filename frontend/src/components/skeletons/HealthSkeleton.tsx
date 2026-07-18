import Skeleton from "../Skeleton";

/** Stat card grid (2×2) + goal/BMI/weight row + chart placeholders.
 *  Matches the HealthAndStatsTab content layout. */
export default function HealthSkeleton() {
  return (
    <div className="health-stats-tab space-y-4" aria-label="Loading health data" role="status">
      {/* Quick Stats grid 2×2 */}
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-3 border border-fg/5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Skeleton width="14px" height="14px" rounded="md" />
              <Skeleton width={`${60 + i * 10}px`} height="10px" rounded="md" />
            </div>
            <Skeleton width="50px" height="24px" rounded="md" />
          </div>
        ))}
      </div>

      {/* Goal Progress + BMI + Log Weight row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl p-4 border border-fg/5 col-span-3 sm:col-span-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <Skeleton width="14px" height="14px" rounded="md" />
            <Skeleton width="70px" height="10px" rounded="md" />
          </div>
          <Skeleton width="100%" height="12px" rounded="full" />
          <div className="flex justify-between">
            <Skeleton width="30px" height="12px" rounded="md" />
            <Skeleton width="30px" height="12px" rounded="md" />
            <Skeleton width="50px" height="12px" rounded="md" />
          </div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Skeleton width="14px" height="14px" rounded="md" />
            <Skeleton width="30px" height="10px" rounded="md" />
          </div>
          <Skeleton width="40px" height="28px" rounded="md" />
          <Skeleton width="60px" height="12px" rounded="md" />
        </div>
        <div className="bg-surface rounded-xl p-4 border border-fg/5 col-span-2 sm:col-span-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <Skeleton width="14px" height="14px" rounded="md" />
            <Skeleton width="60px" height="10px" rounded="md" />
          </div>
          <div className="flex gap-2">
            <Skeleton width="100%" height="32px" rounded="lg" className="flex-1" />
            <Skeleton width="40px" height="32px" rounded="lg" />
          </div>
        </div>
      </div>

      {/* Personal Records card */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton width="14px" height="14px" rounded="md" />
          <Skeleton width="100px" height="14px" rounded="md" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg rounded-lg p-2.5 space-y-1.5">
              <Skeleton width="40px" height="10px" rounded="md" />
              <Skeleton width="30px" height="20px" rounded="md" />
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-3 border border-fg/5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Skeleton width="14px" height="14px" rounded="md" />
              <Skeleton width={`${40 + i * 15}px`} height="10px" rounded="md" />
            </div>
            <Skeleton width="30px" height="24px" rounded="md" />
          </div>
        ))}
      </div>

      {/* Activity chart placeholder */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton width="16px" height="16px" rounded="md" />
          <Skeleton width="120px" height="12px" rounded="md" />
        </div>
        <Skeleton width="100%" height="120px" rounded="lg" />
      </div>
    </div>
  );
}
