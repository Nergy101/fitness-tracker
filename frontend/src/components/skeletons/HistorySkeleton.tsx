import Skeleton from "../Skeleton";

/** Date range filter + summary card + chart + session list + View all + Import/Export.
 *  Mirrors the exact HistoryTab range-view layout to prevent layout shift. */
export default function HistorySkeleton() {
  return (
    <div className="history-tab" aria-label="Loading history" role="status">
      {/* Date range filter — 4 pills + Calendar */}
      <div className="flex gap-2 mb-4">
        {["65px", "65px", "65px", "60px"].map((w, i) => (
          <Skeleton key={i} width={w} height="30px" rounded="full" />
        ))}
        <Skeleton width="78px" height="30px" rounded="full" />
      </div>

      {/* Summary card — matches bg-surface rounded-xl p-4 border border-fg/5 mb-4 */}
      <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-4">
        {/* StatsGrid — grid grid-cols-4 gap-2 mb-3, text-centered */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {["48px", "56px", "40px", "36px"].map((w, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton width={w} height="22px" rounded="md" />
              <Skeleton width="40px" height="10px" rounded="md" />
            </div>
          ))}
        </div>
        {/* Chart area — ~100px tall */}
        <Skeleton width="100%" height="100px" rounded="lg" />
      </div>

      {/* Session list — 5 SessionCard placeholders */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl p-4 border border-fg/5 space-y-2"
          >
            {/* Top row: icon + title | kcal + delete */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton width="16px" height="16px" rounded="md" />
                <Skeleton width={`${100 + i * 20}px`} height="14px" rounded="md" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton width="50px" height="12px" rounded="md" />
                <Skeleton width="14px" height="14px" rounded="md" />
              </div>
            </div>
            {/* Date row: date + edit pencil */}
            <div className="flex items-center gap-1.5">
              <Skeleton width="72px" height="12px" rounded="md" />
              <Skeleton width="12px" height="12px" rounded="md" />
            </div>
            {/* Bottom: duration + exercise count */}
            <div className="flex gap-3">
              <Skeleton width="44px" height="12px" rounded="md" />
              <Skeleton width="60px" height="12px" rounded="md" />
            </div>
          </div>
        ))}
      </div>

      {/* "View all" button */}
      <div className="mt-4">
        <Skeleton width="100%" height="42px" rounded="xl" />
      </div>

      {/* Import / Export buttons */}
      <div className="flex gap-2 mt-2">
        <Skeleton width="50%" height="42px" rounded="xl" />
        <Skeleton width="50%" height="42px" rounded="xl" />
      </div>
    </div>
  );
}
