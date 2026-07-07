import { useEffect, useState } from "react";
import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  BarbellIcon as Barbell,
  ChartBarIcon as ChartBar,
  FireIcon as Fire,
  CalendarBlankIcon as CalendarBlank,
  PlantIcon as Plant,
  RocketLaunchIcon as RocketLaunch,
  SneakerIcon as Sneaker,
  TrendDownIcon as TrendDown,
  TrendUpIcon as TrendUp,
  ScalesIcon as Scales,
  PersonSimpleRunIcon as PersonSimpleRun,
  type Icon,
} from "@phosphor-icons/react";
import {
  api,
  type StatsOverviewResponse,
  type WeeklyActivityStat,
} from "../api";
import { ACTIVITY_COLORS } from "../activity";
import ActivityLegend from "./ActivityLegend";
import { formatHours } from "../format";

// ─── Stacked Bar Chart ─────────────────────────────────────

interface StackSegment<T> {
  color: string;
  value: (d: T) => number;
}

/** Weekly bars where each bar stacks one segment per activity type. */
function StackedBarChart<T>({
  data,
  segments,
  label,
  height = 80,
}: {
  data: T[];
  segments: StackSegment<T>[];
  label: (d: T) => string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(
    1,
    ...data.map((d) => segments.reduce((sum, seg) => sum + seg.value(d), 0)),
  );
  const wPerBar = 28;
  const w = Math.max(wPerBar * data.length, wPerBar);

  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full" style={{ maxHeight: height + 20 }}>
      {data.map((d, i) => {
        const x = i * wPerBar + 2;
        const parts = segments
          .map((seg) => ({ color: seg.color, val: seg.value(d) }))
          .filter((p) => p.val > 0);
        let yCursor = height;
        return (
          <g key={i}>
            {parts.map((p, j) => {
              const barH = Math.max((p.val / max) * height, 1);
              yCursor -= barH;
              const isTop = j === parts.length - 1;
              return (
                <rect
                  key={j}
                  x={x}
                  y={yCursor}
                  width={wPerBar - 4}
                  height={barH}
                  rx={isTop ? 2 : 0}
                  fill={p.color}
                  opacity={0.8}
                />
              );
            })}
            <text
              x={x + (wPerBar - 4) / 2}
              y={height + 12}
              textAnchor="middle"
              className="fill-fg/30"
              fontSize="8"
            >
              {label(d).slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-3 border border-fg/5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-fg/40">{label}</span>
      </div>
      <p className="text-lg font-bold text-fg">{value}</p>
      {sub && <p className="text-[10px] text-fg/30 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function StatisticsTab() {
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStatsOverview()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-fg/40">Loading stats...</div>;
  }
  if (!stats) {
    return <div className="text-center py-8 text-fg/40">Failed to load stats.</div>;
  }

  const insightLines: { icon: Icon; text: string }[] = [];
  if (stats.current_month_vs_previous_pct != null) {
    const pct = stats.current_month_vs_previous_pct;
    if (pct > 0) {
      insightLines.push({ icon: TrendUp, text: `You exercised ${Math.round(pct)}% more this month than last!` });
    } else if (pct < 0) {
      insightLines.push({ icon: TrendDown, text: `Your workout time dropped ${Math.round(Math.abs(pct))}% this month.` });
    } else {
      insightLines.push({ icon: ChartBar, text: "Your workout volume is steady this month." });
    }
  }
  if (stats.consistency_score_pct > 0) {
    const cons = stats.consistency_score_pct;
    if (cons >= 80) insightLines.push({ icon: Fire, text: `${cons}% consistency — you're on fire!` });
    else if (cons >= 50) insightLines.push({ icon: Barbell, text: `${cons}% consistency — keep showing up!` });
    else insightLines.push({ icon: Plant, text: `${cons}% consistency — start small, stay steady!` });
  }
  if (stats.avg_weight_change_kg != null) {
    const w = stats.avg_weight_change_kg;
    if (w < 0) {
      insightLines.push({ icon: ArrowDown, text: `Your weight dropped ${Math.abs(w).toFixed(1)} kg this month.` });
    } else if (w > 0) {
      insightLines.push({ icon: ArrowUp, text: `Your weight increased ${w.toFixed(1)} kg this month.` });
    }
  }
  if (stats.total_sessions_all === 0) {
    insightLines.push({ icon: RocketLaunch, text: "Complete your first workout to see stats!" });
  }

  const weeks = [...stats.activity_weekly].reverse();
  const hasDistance = weeks.some((w) => w.run_km + w.walk_km > 0);

  return (
    <div className="stats-tab space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChartBar size={22} className="text-accent" weight="fill" />
        <h2 className="text-sm font-semibold">Statistics</h2>
      </div>

      {/* Insight cards */}
      {insightLines.length > 0 && (
        <div className="space-y-1.5">
          {insightLines.map(({ icon: InsightIcon, text }, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-fg/70 bg-surface rounded-lg px-3 py-2 border border-fg/5">
              <InsightIcon size={14} className="text-accent shrink-0" />
              {text}
            </p>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Fire size={14} className="text-orange-400" />}
          label="Total kcal burned"
          value={stats.total_kcal_burned.toLocaleString()}
        />
        <StatCard
          icon={<CalendarBlank size={14} className="text-accent" />}
          label="Consistency (30d)"
          value={`${stats.consistency_score_pct}%`}
        />
        <StatCard
          icon={<Barbell size={14} style={{ color: ACTIVITY_COLORS.workout }} />}
          label="Total workouts"
          value={String(stats.total_sessions_all)}
        />
        <StatCard
          icon={<Scales size={14} className="text-purple-400" />}
          label="Weight change (month)"
          value={
            stats.avg_weight_change_kg != null
              ? `${stats.avg_weight_change_kg > 0 ? "+" : ""}${stats.avg_weight_change_kg.toFixed(1)} kg`
              : "—"
          }
        />
        <StatCard
          icon={<PersonSimpleRun size={14} style={{ color: ACTIVITY_COLORS.run }} />}
          label="Total runs"
          value={String(stats.total_runs)}
        />
        <StatCard
          icon={<Sneaker size={14} style={{ color: ACTIVITY_COLORS.walk }} />}
          label="Total walks"
          value={String(stats.total_walks)}
        />
      </div>

      {/* Weekly activity: workouts + runs + walks stacked */}
      {weeks.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendUp size={16} className="text-accent" />
            <p className="text-xs text-fg/40">Weekly Activity (min)</p>
          </div>
          <StackedBarChart
            data={weeks}
            segments={[
              { color: ACTIVITY_COLORS.workout, value: (d: WeeklyActivityStat) => d.workout_minutes },
              { color: ACTIVITY_COLORS.run, value: (d: WeeklyActivityStat) => d.run_minutes },
              { color: ACTIVITY_COLORS.walk, value: (d: WeeklyActivityStat) => d.walk_minutes },
            ]}
            label={(d) => d.week_start}
          />
          <ActivityLegend kinds={["workout", "run", "walk"]} />
          {stats.current_month_vs_previous_pct != null && (
            <div className="flex justify-between mt-2 text-[10px] text-fg/40">
              <span>This month: {formatHours(stats.current_month_minutes)}</span>
              <span className={stats.current_month_vs_previous_pct >= 0 ? "text-green-400" : "text-orange-400"}>
                {stats.current_month_vs_previous_pct >= 0 ? "+" : ""}{stats.current_month_vs_previous_pct.toFixed(0)}%
              </span>
              <span>Last: {formatHours(stats.previous_month_minutes)}</span>
            </div>
          )}
        </div>
      )}

      {/* Weekly distance: runs + walks stacked */}
      {hasDistance && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-1.5 mb-2">
            <PersonSimpleRun size={16} style={{ color: ACTIVITY_COLORS.run }} />
            <p className="text-xs text-fg/40">Weekly Distance (km)</p>
          </div>
          <StackedBarChart
            data={weeks}
            segments={[
              { color: ACTIVITY_COLORS.run, value: (d: WeeklyActivityStat) => d.run_km },
              { color: ACTIVITY_COLORS.walk, value: (d: WeeklyActivityStat) => d.walk_km },
            ]}
            label={(d) => d.week_start}
          />
          <ActivityLegend kinds={["run", "walk"]} />
        </div>
      )}
    </div>
  );
}
