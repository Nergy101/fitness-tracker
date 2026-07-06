import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Barbell,
  ChartBar,
  Fire,
  CalendarBlank,
  Plant,
  RocketLaunch,
  TrendDown,
  TrendUp,
  Scales,
  PersonSimpleRun,
  type Icon,
} from "@phosphor-icons/react";
import {
  api,
  type StatsOverviewResponse,
} from "../api";
import { formatHours } from "../format";

// ─── Color palette ─────────────────────────────────────────

const ACCENT = "var(--accent)";

// ─── Bar Chart Component ───────────────────────────────────

function BarChart({
  data,
  valueKey,
  labelKey,
  color,
  height = 80,
  maxValue,
}: {
  data: any[];
  valueKey: string;
  labelKey: string;
  color: string;
  height?: number;
  maxValue?: number;
}) {
  if (data.length === 0) return null;
  const max = maxValue ?? Math.max(1, ...data.map((d) => d[valueKey]));
  const wPerBar = 28;
  const w = Math.max(wPerBar * data.length, wPerBar);

  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full" style={{ maxHeight: height + 20 }}>
      {data.map((d, i) => {
        const val = d[valueKey] ?? 0;
        const barH = (val / max) * height;
        const x = i * wPerBar + 2;
        const y = height - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={wPerBar - 4}
              height={Math.max(barH, 1)}
              rx={2}
              fill={color}
              opacity={0.8}
            />
            <text
              x={x + (wPerBar - 4) / 2}
              y={height + 12}
              textAnchor="middle"
              className="fill-fg/30"
              fontSize="8"
            >
              {d[labelKey]?.slice(5) ?? ""}
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
      <p className="text-lg font-bold text-white">{value}</p>
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
          sub={`${stats.total_sessions_all} total workouts`}
        />
        <StatCard
          icon={<PersonSimpleRun size={14} className="text-blue-400" />}
          label="Total runs"
          value={String(stats.total_runs)}
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
      </div>

      {/* Workout volume bar chart */}
      {stats.workout_volume_weekly.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendUp size={16} className="text-accent" />
            <p className="text-xs text-fg/40">Workout Volume (weekly min)</p>
          </div>
          <BarChart
            data={[...stats.workout_volume_weekly].reverse()}
            valueKey="total_minutes"
            labelKey="week_start"
            color={ACCENT}
          />
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

      {/* Run distance bar chart */}
      {stats.run_distance_weekly.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-1.5 mb-2">
            <PersonSimpleRun size={16} className="text-blue-400" />
            <p className="text-xs text-fg/40">Weekly Run Distance (km)</p>
          </div>
          <BarChart
            data={[...stats.run_distance_weekly].reverse()}
            valueKey="total_distance_km"
            labelKey="week_start"
            color="#38bdf8"
          />
        </div>
      )}
    </div>
  );
}
