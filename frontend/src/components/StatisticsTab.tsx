import { useEffect, useState } from "react";
import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  BarbellIcon as Barbell,
  ChartBarIcon as ChartBar,
  ChartPieSliceIcon as ChartPieSlice,
  FireIcon as Fire,
  FootprintsIcon as Footprints,
  CalendarBlankIcon as CalendarBlank,
  HeartIcon as Heart,
  MoonIcon as Moon,
  PlantIcon as Plant,
  PulseIcon as Pulse,
  RocketLaunchIcon as RocketLaunch,
  SneakerIcon as Sneaker,
  TimerIcon as Timer,
  TrendDownIcon as TrendDown,
  TrendUpIcon as TrendUp,
  ScalesIcon as Scales,
  PersonSimpleRunIcon as PersonSimpleRun,
  WarningIcon as Warning,
  type Icon,
} from "@phosphor-icons/react";
import {
  api,
  type GoalProgressResponse,
  type HealthInsightsResponse,
  type HealthSeries,
  type RunEntryResponse,
  type StatsOverviewResponse,
  type WeeklyActivityStat,
  type WeightEntryResponse,
} from "../api";
import { ACTIVITY_COLORS, ACTIVITY_LABELS, type ActivityKind } from "../activity";
import ActivityLegend from "./ActivityLegend";
import ChartCard from "./ChartCard";
import AppleHealthCharts from "./health/AppleHealthCharts";
import { niceTicks } from "./health/ticks"
import { formatHours } from "../format";

const WEIGHT_COLOR = "#c084fc"; // purple-400 — matches the weight stat card icon

// Per-metric presentation for imported Apple Health series.
const HEALTH_META: Record<string, { icon: Icon; color: string }> = {
  resting_heart_rate: { icon: Heart, color: "#f87171" },   // red-400
  vo2_max: { icon: Pulse, color: "#2dd4bf" },              // teal-400
  step_count: { icon: Footprints, color: "#60a5fa" },      // blue-400
  sleep_analysis: { icon: Moon, color: "#818cf8" },        // indigo-400
  active_energy: { icon: Fire, color: "#f59e0b" },         // amber-500
  apple_exercise_time: { icon: Timer, color: "#34d399" },  // emerald-400
};

function formatHealthValue(metric: string, v: number): string {
  if (metric === "step_count") return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
  if (metric === "vo2_max" || metric === "sleep_analysis") return v.toFixed(1);
  return String(Math.round(v));
}

/** Seconds-per-km as "m:ss" (e.g. 324 → "5:24"). */
function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Stacked Bar Chart ─────────────────────────────────────

interface StackSegment<T> {
  color: string;
  value: (d: T) => number;
}

/** Weekly bars where each bar stacks one segment per activity type, with a
 *  y-axis (gridlines + unit-formatted tick labels) so values are readable. */
function StackedBarChart<T>({
  data,
  segments,
  label,
  formatValue,
  height = 80,
}: {
  data: T[];
  segments: StackSegment<T>[];
  label: (d: T) => string;
  formatValue: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(
    1,
    ...data.map((d) => segments.reduce((sum, seg) => sum + seg.value(d), 0)),
  );
  const wPerBar = 28;
  const gutter = 30; // left space for the y-axis labels
  const w = gutter + Math.max(wPerBar * data.length, wPerBar);
  const ticks = [max, max / 2];

  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full" style={{ maxHeight: height + 20 }}>
      {ticks.map((t) => {
        const y = height - (t / max) * height;
        return (
          <g key={t}>
            <line x1={gutter} y1={y} x2={w} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
            {/* Clamp so the top tick's text isn't clipped by the viewBox edge */}
            <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/30" fontSize="8">
              {formatValue(t)}
            </text>
          </g>
        );
      })}
      <line x1={gutter} y1={height} x2={w} y2={height} className="stroke-fg/10" strokeWidth="0.5" />
      {data.map((d, i) => {
        const x = gutter + i * wPerBar + 2;
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

// ─── Line Chart ────────────────────────────────────────────

/** SVG line with dots, min/max axis labels, and an optional dashed
 *  reference line (e.g. goal weight, best pace). */
function LineChart({
  points,
  color,
  formatValue,
  reference,
  overlay,
  height = 90,
}: {
  points: { label: string; value: number }[];
  color: string;
  formatValue: (v: number) => string;
  reference?: { value: number; label: string };
  /** Same-length smoothed series (e.g. 7-day rolling average), drawn dashed. */
  overlay?: number[];
  height?: number;
}) {
  if (points.length < 2) return null;
  const w = 300;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (reference) {
    lo = Math.min(lo, reference.value);
    hi = Math.max(hi, reference.value);
  }
  const trueMin = Math.min(...values, reference?.value ?? Infinity);
  const pad = (hi - lo) * 0.12 || 1;
  // Don't pad the floor below zero for non-negative series (e.g. steps that
  // dip near 0) — a negative axis label reads as nonsense.
  lo = trueMin >= 0 ? Math.max(0, lo - pad) : lo - pad;
  hi += pad;
  const range = hi - lo;
  const px = (i: number) => 24 + (i / (points.length - 1)) * (w - 30);
  const py = (v: number) => height - ((v - lo) / range) * height;
  const labelIdxs = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const ticks = niceTicks(lo, hi, 4);

  return (
    <svg viewBox={`0 0 ${w} ${height + 18}`} className="w-full" style={{ maxHeight: height + 18 }}>
      {ticks.map((t) => {
        const y = py(t);
        if (y < 5 || y > height - 1) return null;
        return (
          <g key={t}>
            <line x1={24} y1={y} x2={w} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={20} y={y + 2.5} textAnchor="end" className="fill-fg/30" fontSize="8">
              {formatValue(t)}
            </text>
          </g>
        );
      })}
      {reference && (
        <g>
          <line
            x1={24}
            y1={py(reference.value)}
            x2={w}
            y2={py(reference.value)}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity={0.45}
          />
          <text x={w} y={py(reference.value) - 3} textAnchor="end" className="fill-fg/40" fontSize="8">
            {reference.label}
          </text>
        </g>
      )}
      {overlay && overlay.length === points.length && (
        <polyline
          points={overlay.map((v, i) => `${px(i)},${py(v)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity={0.55}
        />
      )}
      <polyline
        points={points.map((p, i) => `${px(i)},${py(p.value)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={px(i)} cy={py(p.value)} r="2.5" fill={color} />
      ))}
      {labelIdxs.map((idx) => (
        <text key={idx} x={px(idx)} y={height + 13} textAnchor="middle" className="fill-fg/30" fontSize="8">
          {points[idx].label}
        </text>
      ))}
    </svg>
  );
}

// ─── Activity Mix ──────────────────────────────────────────

/** 100% split bar of time per activity type over the given weeks. */
function ActivityMixBar({ weeks }: { weeks: WeeklyActivityStat[] }) {
  const minutes: Record<ActivityKind, number> = { workout: 0, run: 0, walk: 0, boxing: 0 };
  for (const w of weeks) {
    minutes.workout += w.workout_minutes;
    minutes.run += w.run_minutes;
    minutes.walk += w.walk_minutes;
    minutes.boxing += w.boxing_minutes;
  }
  const total = minutes.workout + minutes.run + minutes.walk + minutes.boxing;
  if (total <= 0) return null;
  const kinds = (["workout", "run", "walk", "boxing"] as const).filter((k) => minutes[k] > 0);

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden">
        {kinds.map((k) => (
          <div
            key={k}
            style={{ width: `${(minutes[k] / total) * 100}%`, background: ACTIVITY_COLORS[k] }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2">
        {kinds.map((k) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-fg/40">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ACTIVITY_COLORS[k] }} />
            {ACTIVITY_LABELS[k]} {Math.round((minutes[k] / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
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

// ─── Chart Card ─────────────────────────────────────────────

// ChartCard lives in ./ChartCard.tsx (shared with the Apple Health charts).

// ─── Health Trend Card ─────────────────────────────────────

/** One imported Apple Health metric as a trend line, with icon, latest value,
 *  and average over the window. Shows the card even with a single point
 *  (just no line chart until there are 2+). Metric-specific extras: a dashed
 *  7-day rolling average for noisy daily series, and Apple's 30-minute ring
 *  goal on exercise minutes. */
const ROLLING_AVG_METRICS = new Set(["resting_heart_rate", "step_count"]);

function rollingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function HealthTrendChart({ series }: { series: HealthSeries }) {
  if (series.points.length === 0) return null;
  const meta = HEALTH_META[series.metric] ?? { icon: Pulse, color: "var(--accent)" };
  const MetricIcon = meta.icon;
  const latest = series.points[series.points.length - 1].value;
  const avg = series.points.reduce((s, p) => s + p.value, 0) / series.points.length;
  const values = series.points.map((p) => p.value);
  return (
    <ChartCard
      icon={<MetricIcon size={16} style={{ color: meta.color }} />}
      title={series.label}
      sub={`${formatHealthValue(series.metric, latest)} ${series.unit} · avg ${formatHealthValue(series.metric, avg)}`}
    >
      {series.points.length >= 2 && (
        <LineChart
          points={series.points.map((p) => ({ label: p.date.slice(5), value: p.value }))}
          color={meta.color}
          formatValue={(v) => formatHealthValue(series.metric, v)}
          overlay={ROLLING_AVG_METRICS.has(series.metric) ? rollingAvg(values, 7) : undefined}
          reference={series.metric === "apple_exercise_time" ? { value: 30, label: "goal 30 min" } : undefined}
        />
      )}
      {series.points.length === 1 && (
        <p className="text-[10px] text-fg/30 text-center py-2">
          More data needed for trend — keep syncing
        </p>
      )}
    </ChartCard>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function StatisticsTab() {
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [runs, setRuns] = useState<RunEntryResponse[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntryResponse[]>([]);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);
  const [health, setHealth] = useState<HealthInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStatsOverview(),
      api.getRuns().catch(() => [] as RunEntryResponse[]),
      api.getWeightEntries().catch(() => [] as WeightEntryResponse[]),
      api.getGoalProgress().catch(() => null),
      api.getHealthInsights(120).catch(() => null),
    ])
      .then(([overview, runList, weights, goalProgress, healthInsights]) => {
        setStats(overview);
        setRuns(runList);
        setWeightEntries(weights);
        setGoal(goalProgress);
        setHealth(healthInsights);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-fg/40">Loading stats...</div>;
  }
  if (!stats) {
    return <div className="text-center py-8 text-fg/40">Failed to load stats.</div>;
  }

  const weeks = [...stats.activity_weekly].reverse(); // oldest → newest
  const hasDistance = weeks.some((w) => w.run_km + w.walk_km > 0);
  const hasKcal = weeks.some((w) => w.workout_kcal + w.run_kcal + w.walk_kcal > 0);
  const mixWeeks = weeks.slice(-4);

  // Pace trend: real runs with a meaningful distance, oldest first.
  const pacedRuns = runs
    .filter((r) => r.run_type !== "walk" && r.pace_per_km != null && r.distance_km >= 1)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);
  const bestPace = pacedRuns.length > 0 ? Math.min(...pacedRuns.map((r) => r.pace_per_km as number)) : null;

  // Weight journey: oldest first.
  const weightSeries = [...weightEntries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  // ── Coach insights ──
  const insightLines: { icon: Icon; text: string; tone?: "warn" }[] = [];

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

  // Ramp check: warn only when the (possibly partial) current week already
  // exceeds the previous full week by >30% — the classic overuse pattern.
  if (weeks.length >= 2) {
    const cur = weeks[weeks.length - 1];
    const prev = weeks[weeks.length - 2];
    const curKm = cur.run_km + cur.walk_km;
    const prevKm = prev.run_km + prev.walk_km;
    if (prevKm > 0 && curKm > prevKm * 1.3) {
      insightLines.push({
        icon: Warning,
        tone: "warn",
        text: `Distance is up ${Math.round(((curKm - prevKm) / prevKm) * 100)}% vs last week — ramp up gradually to avoid injury.`,
      });
    }
  }

  // Strength/cardio balance over the last 4 weeks.
  {
    const strength = mixWeeks.reduce((s, w) => s + w.workout_minutes, 0);
    const cardio = mixWeeks.reduce((s, w) => s + w.run_minutes + w.walk_minutes, 0);
    const total = strength + cardio;
    if (total > 0) {
      const cardioShare = cardio / total;
      if (cardioShare < 0.2) {
        insightLines.push({ icon: PersonSimpleRun, text: "Mostly strength lately — mix in a run or walk for your heart." });
      } else if (cardioShare > 0.8) {
        insightLines.push({ icon: Barbell, text: "Mostly cardio lately — add a strength workout to stay balanced." });
      }
    }
  }

  // remaining_kg is signed (goal - current): negative on a loss journey,
  // positive on a gain journey. "Reached" comes from progress_percentage.
  if (goal?.goal_weight_kg != null && goal.remaining_kg != null) {
    if ((goal.progress_percentage ?? 0) >= 100) {
      insightLines.push({ icon: Scales, text: "Goal weight reached — now hold the line!" });
    } else {
      insightLines.push({ icon: Scales, text: `${Math.abs(goal.remaining_kg).toFixed(1)} kg to your goal weight — keep going!` });
    }
  }

  if (stats.avg_weight_change_kg != null) {
    const w = stats.avg_weight_change_kg;
    if (w < 0) {
      insightLines.push({ icon: ArrowDown, text: `Your weight dropped ${Math.abs(w).toFixed(1)} kg this month.` });
    } else if (w > 0) {
      insightLines.push({ icon: ArrowUp, text: `Your weight increased ${w.toFixed(1)} kg this month.` });
    }
  }
  if (stats.total_sessions_all === 0 && stats.total_runs === 0 && stats.total_walks === 0) {
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
          {insightLines.map(({ icon: InsightIcon, text, tone }, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-fg/70 bg-surface rounded-lg px-3 py-2 border border-fg/5">
              <InsightIcon size={14} className={`shrink-0 ${tone === "warn" ? "text-orange-400" : "text-accent"}`} />
              {text}
            </p>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Fire size={14} className="text-orange-400" />}
          label="Total kcal (30d)"
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
          label="Weight change (30d)"
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

      {/* Training mix */}
      {mixWeeks.length > 0 && (
        <ChartCard
          icon={<ChartPieSlice size={16} className="text-accent" />}
          title="Training Mix"
          sub="last 4 weeks, by time"
        >
          <ActivityMixBar weeks={mixWeeks} />
        </ChartCard>
      )}

      {/* Weekly activity: workouts + runs + walks stacked */}
      {weeks.length > 0 && (
        <ChartCard icon={<TrendUp size={16} className="text-accent" />} title="Weekly Activity (min)">
          <StackedBarChart
            data={weeks}
            segments={[
              { color: ACTIVITY_COLORS.workout, value: (d: WeeklyActivityStat) => d.workout_minutes },
              { color: ACTIVITY_COLORS.run, value: (d: WeeklyActivityStat) => d.run_minutes },
              { color: ACTIVITY_COLORS.walk, value: (d: WeeklyActivityStat) => d.walk_minutes },
            ]}
            label={(d) => d.week_start}
            formatValue={(v) => (v >= 120 ? `${(v / 60).toFixed(1)}h` : `${Math.round(v)}m`)}
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
        </ChartCard>
      )}

      {/* Weekly energy burn */}
      {hasKcal && (
        <ChartCard icon={<Fire size={16} className="text-orange-400" />} title="Weekly Energy Burn (kcal)">
          <StackedBarChart
            data={weeks}
            segments={[
              { color: ACTIVITY_COLORS.workout, value: (d: WeeklyActivityStat) => d.workout_kcal },
              { color: ACTIVITY_COLORS.run, value: (d: WeeklyActivityStat) => d.run_kcal },
              { color: ACTIVITY_COLORS.walk, value: (d: WeeklyActivityStat) => d.walk_kcal },
            ]}
            label={(d) => d.week_start}
            formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
          />
          <ActivityLegend kinds={["workout", "run", "walk"]} />
        </ChartCard>
      )}

      {/* Weekly distance: runs + walks stacked */}
      {hasDistance && (
        <ChartCard
          icon={<PersonSimpleRun size={16} style={{ color: ACTIVITY_COLORS.run }} />}
          title="Weekly Distance (km)"
        >
          <StackedBarChart
            data={weeks}
            segments={[
              { color: ACTIVITY_COLORS.run, value: (d: WeeklyActivityStat) => d.run_km },
              { color: ACTIVITY_COLORS.walk, value: (d: WeeklyActivityStat) => d.walk_km },
            ]}
            label={(d) => d.week_start}
            formatValue={(v) => `${Math.round(v * 10) / 10}km`}
          />
          <ActivityLegend kinds={["run", "walk"]} />
        </ChartCard>
      )}

      {/* Pace trend */}
      {pacedRuns.length >= 2 && (
        <ChartCard
          icon={<Timer size={16} style={{ color: ACTIVITY_COLORS.run }} />}
          title="Run Pace Trend"
          sub="lower is faster"
        >
          <LineChart
            points={pacedRuns.map((r) => ({ label: r.date.slice(5), value: r.pace_per_km as number }))}
            color={ACTIVITY_COLORS.run}
            formatValue={(v) => formatPace(v)}
            reference={bestPace != null ? { value: bestPace, label: `best ${formatPace(bestPace)}/km` } : undefined}
          />
        </ChartCard>
      )}

      {/* Weight journey */}
      {weightSeries.length >= 2 && (
        <ChartCard
          icon={<Scales size={16} style={{ color: WEIGHT_COLOR }} />}
          title="Weight Journey"
          sub={
            goal?.goal_weight_kg != null
              ? `goal ${goal.goal_weight_kg.toFixed(1)} kg`
              : undefined
          }
        >
          <LineChart
            points={weightSeries.map((e) => ({ label: e.date.slice(5), value: e.weight_kg }))}
            color={WEIGHT_COLOR}
            formatValue={(v) => `${v.toFixed(1)}`}
            reference={
              goal?.goal_weight_kg != null
                ? { value: goal.goal_weight_kg, label: `goal ${goal.goal_weight_kg.toFixed(1)} kg` }
                : undefined
            }
          />
        </ChartCard>
      )}

      {/* Apple Health vitals (imported). Sleep and heart_rate get specialized
          charts (stage stack, min–max band) in AppleHealthCharts; the rest
          render as generic trend lines. */}
      {health && health.series.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <Heart size={18} className="text-red-400" weight="fill" />
            <h3 className="text-sm font-semibold">Apple Health</h3>
          </div>
          {health.series
            .filter((s) => s.metric !== "sleep_analysis" && s.metric !== "heart_rate")
            .map((s) => (
              <HealthTrendChart key={s.metric} series={s} />
            ))}
          <AppleHealthCharts series={health.series} weightEntries={weightEntries} />
        </>
      )}
    </div>
  );
}
