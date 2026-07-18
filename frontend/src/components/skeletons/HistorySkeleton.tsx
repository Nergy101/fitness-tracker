import Skeleton from "../Skeleton";

/** Date range filter + summary card + 5 session list placeholders.
 *  Matches the HistoryTab content layout. */
export default function HistorySkeleton() {
  return (
    <div className="history-tab" aria-label="Loading history" role="status">
      {/* Date range filter */}
      <div className="flex gap-2 mb-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            width={`${40 + i * 10}px`}
            height="32px"
            rounded="full"
          />
        ))}
        <Skeleton width="32px" height="32px" rounded="full" className="ml-auto" />
      </div>

      {/* Summary card */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4 space-y-3">
        {/* Stats grid: 4 stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton width="14px" height="14px" rounded="md" />
                <Skeleton width="40px" height="10px" rounded="md" />
              </div>
              <Skeleton width="50px" height="22px" rounded="md" />
            </div>
          ))}
        </div>
        {/* Chart area */}
        <Skeleton width="100%" height="120px" rounded="lg" />
      </div>

      {/* 5 Session list placeholders */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl p-3 border border-fg/5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Skeleton width={`${100 + i * 20}px`} height="14px" rounded="md" />
              <Skeleton width="24px" height="24px" rounded="md" />
            </div>
            <div className="flex gap-3">
              <Skeleton width="60px" height="12px" rounded="md" />
              <Skeleton width="50px" height="12px" rounded="md" />
              <Skeleton width="40px" height="12px" rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
