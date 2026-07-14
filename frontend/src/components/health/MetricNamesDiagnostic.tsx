import { useState } from "react";
import { CaretDownIcon as CaretDown, CaretUpIcon as CaretUp, PulseIcon as Pulse } from "@phosphor-icons/react";
import { api, type MetricNameStat } from "../../api";

/** Collapsible diagnostic listing every distinct imported Apple Health metric
 *  name with its row count, date span, and latest value. Lets you confirm from
 *  the UI whether a metric (e.g. vo2_max) is actually arriving — and under
 *  which name — without querying the production database directly. */
export default function MetricNamesDiagnostic() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MetricNameStat[] | null>(null);
  const [error, setError] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null && !loading) {
      setLoading(true);
      setError(false);
      api
        .getMetricNames()
        .then((r) => setRows(r.metrics))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }
  };

  const hasVo2 = rows?.some((r) => r.metric_name.toLowerCase().includes("vo2")) ?? false;

  return (
    <div className="bg-surface rounded-xl border border-fg/5 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full p-4 flex items-center justify-between"
        aria-label="Toggle imported metrics diagnostic"
      >
        <div className="flex items-center gap-3">
          <Pulse size={22} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-fg">Imported metrics (diagnostic)</span>
        </div>
        {open ? <CaretUp size={18} className="text-fg/40" /> : <CaretDown size={18} className="text-fg/40" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {loading && <p className="text-xs text-fg/40 py-2">Loading…</p>}
          {error && <p className="text-xs text-orange-400 py-2">Couldn't load metric names.</p>}
          {!loading && !error && rows !== null && rows.length === 0 && (
            <p className="text-xs text-fg/50 py-2">
              No Apple Health data has been imported yet. Health Auto Export isn't reaching the API,
              or no metrics are enabled in its automation.
            </p>
          )}
          {!loading && !error && rows !== null && rows.length > 0 && (
            <>
              <p className={`text-xs py-2 ${hasVo2 ? "text-green-400" : "text-orange-400"}`}>
                {hasVo2
                  ? "vo2_max data is present — check its latest date below."
                  : "No vo2_max rows found. Apple likely hasn't recorded a Cardio Fitness value (needs an outdoor Walk/Run/Hike with Apple Watch), or it isn't enabled in Health Auto Export."}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-fg/40 text-left">
                      <th className="py-1 pr-3 font-medium">Metric</th>
                      <th className="py-1 pr-3 font-medium text-right">Rows</th>
                      <th className="py-1 pr-3 font-medium">Latest</th>
                      <th className="py-1 font-medium text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.metric_name} className="border-t border-fg/5">
                        <td className="py-1 pr-3 font-mono text-fg/80">{r.metric_name}</td>
                        <td className="py-1 pr-3 text-right text-fg/60">{r.count}</td>
                        <td className="py-1 pr-3 text-fg/60">{r.latest ?? "—"}</td>
                        <td className="py-1 text-right text-fg/60">
                          {r.latest_qty != null ? r.latest_qty.toFixed(1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
