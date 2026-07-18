import Skeleton from "../Skeleton";

/** Multiple ChartCard placeholders matching StatsTab chart heights.
 *  Training mix, daily/weekly toggle, activity charts, and chart cards. */
export default function StatsSkeleton() {
  return (
    <div className="stats-tab space-y-4" aria-label="Loading stats" role="status">
      {/* Training Mix card */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Skeleton width="16px" height="16px" rounded="md" />
            <Skeleton width="100px" height="12px" rounded="md" />
          </div>
          <Skeleton width="60px" height="10px" rounded="md" />
        </div>
        <Skeleton width="100%" height="28px" rounded="lg" />
      </div>

      {/* Daily/Weekly toggle */}
      <div className="flex items-center gap-2">
        <Skeleton width="48px" height="16px" rounded="md" />
        <div className="ml-auto flex gap-0.5">
          <Skeleton width="52px" height="28px" rounded="full" />
          <Skeleton width="60px" height="28px" rounded="full" />
        </div>
      </div>

      {/* Activity chart */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton width="16px" height="16px" rounded="md" />
          <Skeleton width="140px" height="12px" rounded="md" />
        </div>
        <Skeleton width="100%" height="140px" rounded="lg" />
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <Skeleton width="8px" height="8px" rounded="full" />
              <Skeleton width="30px" height="10px" rounded="md" />
            </div>
          ))}
        </div>
      </div>

      {/* Energy burn chart */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton width="16px" height="16px" rounded="md" />
          <Skeleton width="160px" height="12px" rounded="md" />
        </div>
        <Skeleton width="100%" height="140px" rounded="lg" />
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <Skeleton width="8px" height="8px" rounded="full" />
              <Skeleton width="30px" height="10px" rounded="md" />
            </div>
          ))}
        </div>
      </div>

      {/* Distance chart */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Skeleton width="16px" height="16px" rounded="md" />
          <Skeleton width="140px" height="12px" rounded="md" />
        </div>
        <Skeleton width="100%" height="140px" rounded="lg" />
      </div>

      {/* Pace trend */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Skeleton width="16px" height="16px" rounded="md" />
            <Skeleton width="100px" height="12px" rounded="md" />
          </div>
          <Skeleton width="80px" height="10px" rounded="md" />
        </div>
        <Skeleton width="100%" height="100px" rounded="lg" />
      </div>

      {/* Weight journey */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Skeleton width="16px" height="16px" rounded="md" />
            <Skeleton width="100px" height="12px" rounded="md" />
          </div>
          <Skeleton width="60px" height="10px" rounded="md" />
        </div>
        <Skeleton width="100%" height="100px" rounded="lg" />
      </div>
    </div>
  );
}
