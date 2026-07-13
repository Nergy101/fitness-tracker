import { FireIcon as Fire, TimerIcon as Timer } from "@phosphor-icons/react";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityKind } from "../../activity";
import { type ActivityStats } from "./utils";
import { StatCard } from "./StatCard";

/** Per-activity all-time summary (Workouts / Running / Walking), mirroring the
 *  Boxing card layout. Driven by activityStats() over the full session list. */
export function ActivityStatsCard({ kind, stats }: { kind: ActivityKind; stats: ActivityStats }) {
  const Icon = ACTIVITY_ICONS[kind];
  const color = ACTIVITY_COLORS[kind];
  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={20} weight="fill" className="shrink-0" style={{ color }} />
        <p className="text-sm font-semibold text-fg">{ACTIVITY_LABELS[kind]}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={<Icon size={14} style={{ color }} />}
          label="Sessions"
          value={String(stats.sessions)}
        />
        <StatCard
          icon={<Timer size={14} style={{ color }} />}
          label="Total hours"
          value={`${stats.total_hours}h`}
        />
        <StatCard
          icon={<Timer size={14} style={{ color }} />}
          label="Avg session"
          value={stats.avg_duration_seconds ? `${Math.round(stats.avg_duration_seconds / 60)}m` : "—"}
        />
        <StatCard
          icon={<Fire size={14} className="text-orange-400" />}
          label="Total kcal"
          value={Math.round(stats.total_kcal_estimated).toLocaleString()}
          sub={stats.avg_kcal_per_min ? `${stats.avg_kcal_per_min.toFixed(1)} kcal/min` : undefined}
        />
      </div>
      {stats.monthly_breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-fg/5">
          <p className="text-xs text-fg/40 mb-2">Monthly</p>
          <div className="space-y-1.5">
            {stats.monthly_breakdown.map((m) => (
              <div key={m.month} className="flex items-center justify-between text-xs">
                <span className="text-fg/60">{m.month}</span>
                <span className="text-fg/40">{m.sessions} sessions · {m.total_minutes} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
