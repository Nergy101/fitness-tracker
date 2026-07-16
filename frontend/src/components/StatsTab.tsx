import { useEffect, useState } from "react";
import {
  ChartPieSliceIcon as ChartPieSlice,
  FireIcon as Fire,
  FootprintsIcon as Footprints,
  HeartIcon as Heart,
  MoonIcon as Moon,
  PersonSimpleRunIcon as PersonSimpleRun,
  PulseIcon as Pulse,
  ScalesIcon as Scales,
  TimerIcon as Timer,
  TrendUpIcon as TrendUp,
  type Icon,
} from "@phosphor-icons/react";
import {
  api,
  type DailyActivityPoint,
  type GoalProgressResponse,
  type HealthInsightsResponse,
  type HealthSeries,
  type RunEntryResponse,
  type StatsOverviewResponse,
  type WeeklyActivityStat,
  type WeightEntryResponse,
  type WorkoutSession,
} from "../api";
import { ACTIVITY_COLORS, ACTIVITY_LABELS, type ActivityKind } from "../activity";
import ActivityLegend from "./ActivityLegend";
import ChartCard from "./ChartCard";
import LoadingSpinner from "./LoadingSpinner";
import AppleHealthCharts from "./health/AppleHealthCharts";
import MetricNamesDiagnostic from "./health/MetricNamesDiagnostic";
import { niceTicks } from "./health/ticks";
import { combineHealthSeries } from "./health/utils";

const WEIGHT_COLOR = "#c084fc"; // purple-400

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
  const gutter = 30;
  // Keep a constant minimum viewBox width so few bars don't inflate the
  // aspect-derived height; bars are distributed across the available span.
  const w = Math.max(300, gutter + wPerBar * data.length);
  const slot = (w - gutter) / data.length;
  const ticks = [max, max / 2];

  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full">
      {ticks.map((t) => {
        const y = height - (t / max) * height;
        return (
          <g key={t}>
            <line x1={gutter} y1={y} x2={w} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/30" fontSize="8">
              {formatValue(t)}
            </text>
          </g>
        );
      })}
      <line x1={gutter} y1={height} x2={w} y2={height} className="stroke-fg/10" strokeWidth="0.5" />
      {data.map((d, i) => {
        const x = gutter + i * slot + 2;
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
                  width={slot - 4}
                  height={barH}
                  rx={isTop ? 2 : 0}
                  fill={p.color}
                  opacity={0.8}
                />
              );
            })}
            <text
              x={x + (slot - 4) / 2}
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

function LineChart({
  points,
  color,
  formatValue,
  reference,
  referenceColor,
  overlay,
  height = 90,
}: {
  points: { label: string; value: number }[];
  color: string;
  formatValue: (v: number) => string;
  reference?: { value: number; label: string };
  referenceColor?: string;
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
  lo = trueMin >= 0 ? Math.max(0, lo - pad) : lo - pad;
  hi += pad;
  const range = hi - lo;
  const px = (i: number) => 24 + (i / (points.length - 1)) * (w - 30);
  const py = (v: number) => height - ((v - lo) / range) * height;
  const labelIdxs = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const ticks = niceTicks(lo, hi, 4);

  return (
    <svg viewBox={`0 0 ${w} ${height + 18}`} className="w-full">
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
            stroke={referenceColor ?? color}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity={0.45}
          />
          <text x={w} y={py(reference.value) - 3} textAnchor="end" className="fill-fg/40" fontSize="8" fill={referenceColor ?? undefined}>
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

// ─── Daily Activity Types & Helpers ─────────────────────────

interface DailyActivityStat {
  date: string;
  label: string;
  workout_minutes: number;
  run_minutes: number;
  walk_minutes: number;
  boxing_minutes: number;
  run_km: number;
  walk_km: number;
  workout_kcal: number;
  run_kcal: number;
  walk_kcal: number;
  boxing_kcal: number;
}

type ChartDatum = {
  workout_minutes: number;
  run_minutes: number;
  walk_minutes: number;
  boxing_minutes: number;
  run_km: number;
  walk_km: number;
  workout_kcal: number;
  run_kcal: number;
  walk_kcal: number;
  boxing_kcal: number;
};

function computeDailyActivity(
  sessions: WorkoutSession[],
  runs: RunEntryResponse[],
): DailyActivityStat[] {
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
  const now = new Date();
  const days: DailyActivityStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: key,
      label: DAYS[(d.getDay() + 6) % 7],
      workout_minutes: 0, run_minutes: 0, walk_minutes: 0, boxing_minutes: 0,
      run_km: 0, walk_km: 0,
      workout_kcal: 0, run_kcal: 0, walk_kcal: 0, boxing_kcal: 0,
    });
  }
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = days.find((x) => x.date === key);
    if (!entry) continue;
    const mins = s.total_duration_seconds / 60;
    const kind = s.template_name.startsWith("Run") ? "run"
      : s.template_name.startsWith("Walk") ? "walk"
      : s.template_name.startsWith("Boxing") ? "boxing"
      : "workout";
    const minKey = `${kind}_minutes` as "workout_minutes" | "run_minutes" | "walk_minutes" | "boxing_minutes";
    entry[minKey] += mins;
    if (s.total_kcal_estimated) {
      const kcalKey = `${kind}_kcal` as "workout_kcal" | "run_kcal" | "walk_kcal" | "boxing_kcal";
      entry[kcalKey] += s.total_kcal_estimated;
    }
  }
  for (const r of runs) {
    const key = r.date.slice(0, 10);
    const entry = days.find((x) => x.date === key);
    if (!entry) continue;
    const kind: "run" | "walk" = r.run_type === "walk" ? "walk" : "run";
    entry[`${kind}_km`] += r.distance_km;
    if (entry[`${kind}_minutes`] === 0) {
      entry[`${kind}_minutes`] = r.duration_seconds / 60;
    }
    entry[`${kind}_kcal`] += r.distance_km * (kind === "run" ? 60 : 45);
  }
  return days;
}

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Health Trend Chart ─────────────────────────────────────

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

export default function StatsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [runs, setRuns] = useState<RunEntryResponse[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntryResponse[]>([]);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);
  const [health, setHealth] = useState<HealthInsightsResponse | null>(null);
  const [activity, setActivity] = useState<DailyActivityPoint[]>([]);

  const [chartMode, setChartMode] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    (async () => {
      try {
        const [overview, runList, sessionList, wEntries, goalProgress, healthInsights, dailyActivity] = await Promise.all([
          api.getStatsOverview(),
          api.getRuns().catch(() => [] as RunEntryResponse[]),
          api.getSessions().catch(() => [] as WorkoutSession[]),
          api.getWeightEntries().catch(() => [] as WeightEntryResponse[]),
          api.getGoalProgress().catch(() => null),
          api.getHealthInsights(120).catch(() => null),
          api.getDailyActivity(120).catch(() => null),
        ]);
        setStats(overview);
        setRuns(runList);
        setSessions(sessionList);
        setWeightEntries(wEntries);
        setGoal(goalProgress);
        setHealth(healthInsights);
        setActivity(dailyActivity?.days ?? []);
      } catch (e) {
        console.error("Failed to load stats data", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading stats" />;
  }
  if (error || !stats) {
    return <div className="text-center py-8 text-fg/40">Failed to load data.</div>;
  }

  const weeks = [...stats.activity_weekly].reverse();
  const daily = computeDailyActivity(sessions, runs);
  const chartData = chartMode === "daily" ? daily : weeks;
  const hasDistance = chartData.some((d: ChartDatum) => (d.run_km || 0) + (d.walk_km || 0) > 0);
  const hasKcal = chartData.some((d: ChartDatum) => (d.workout_kcal || 0) + (d.run_kcal || 0) + (d.walk_kcal || 0) + (d.boxing_kcal || 0) > 0);
  const mixWeeks = weeks.slice(-4);

  const pacedRuns = runs
    .filter((r) => r.run_type !== "walk" && r.pace_per_km != null && r.distance_km >= 1)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);
  const bestPace = pacedRuns.length > 0 ? Math.min(...pacedRuns.map((r) => r.pace_per_km as number)) : null;

  const weightSeries = [...weightEntries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const appMinByDate = new Map(
    activity.filter((d) => d.minutes > 0).map((d) => [d.date, d.minutes] as const),
  );
  const appKcalByDate = new Map(
    activity.filter((d) => d.kcal > 0).map((d) => [d.date, d.kcal] as const),
  );

  return (
    <div className="stats-tab space-y-4">
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

      {/* Activity charts — daily/weekly toggle */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-fg/60">Activity</span>
        <div className="ml-auto flex bg-surface rounded-full p-0.5 border border-fg/10">
          <button
            onClick={() => setChartMode("daily")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              chartMode === "daily" ? "bg-accent text-on-accent" : "text-fg/50"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setChartMode("weekly")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              chartMode === "weekly" ? "bg-accent text-on-accent" : "text-fg/50"
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Activity (min) */}
      {chartData.length > 0 && (
        <ChartCard
          icon={<TrendUp size={16} className="text-accent" />}
          title={chartMode === "daily" ? "Daily Activity (min)" : "Weekly Activity (min)"}
        >
          <StackedBarChart
            data={chartData}
            segments={[
              { color: ACTIVITY_COLORS.workout, value: (d: ChartDatum) => d.workout_minutes },
              { color: ACTIVITY_COLORS.run, value: (d: ChartDatum) => d.run_minutes },
              { color: ACTIVITY_COLORS.walk, value: (d: ChartDatum) => d.walk_minutes },
              { color: ACTIVITY_COLORS.boxing, value: (d: ChartDatum) => d.boxing_minutes },
            ]}
            label={(d: WeeklyActivityStat | DailyActivityStat) => chartMode === "daily" ? (d as DailyActivityStat).label : (d as WeeklyActivityStat).week_start}
            formatValue={(v) => (v >= 120 ? `${(v / 60).toFixed(1)}h` : `${Math.round(v)}m`)}
          />
          <ActivityLegend kinds={["workout", "run", "walk", "boxing"]} />
          {chartMode === "weekly" && stats.current_month_vs_previous_pct != null && (
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

      {/* Energy burn */}
      {hasKcal && (
        <ChartCard
          icon={<Fire size={16} className="text-orange-400" />}
          title={chartMode === "daily" ? "Daily Energy Burn (kcal)" : "Weekly Energy Burn (kcal)"}
        >
          <StackedBarChart
            data={chartData}
            segments={[
              { color: ACTIVITY_COLORS.workout, value: (d: ChartDatum) => d.workout_kcal },
              { color: ACTIVITY_COLORS.run, value: (d: ChartDatum) => d.run_kcal },
              { color: ACTIVITY_COLORS.walk, value: (d: ChartDatum) => d.walk_kcal },
              { color: ACTIVITY_COLORS.boxing, value: (d: ChartDatum) => d.boxing_kcal },
            ]}
            label={(d: WeeklyActivityStat | DailyActivityStat) => chartMode === "daily" ? (d as DailyActivityStat).label : (d as WeeklyActivityStat).week_start}
            formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
          />
          <ActivityLegend kinds={["workout", "run", "walk", "boxing"]} />
        </ChartCard>
      )}

      {/* Distance */}
      {hasDistance && (
        <ChartCard
          icon={<PersonSimpleRun size={16} style={{ color: ACTIVITY_COLORS.run }} />}
          title={chartMode === "daily" ? "Daily Distance (km)" : "Weekly Distance (km)"}
        >
          <StackedBarChart
            data={chartData}
            segments={[
              { color: ACTIVITY_COLORS.run, value: (d: ChartDatum) => d.run_km },
              { color: ACTIVITY_COLORS.walk, value: (d: ChartDatum) => d.walk_km },
            ]}
            label={(d: WeeklyActivityStat | DailyActivityStat) => chartMode === "daily" ? (d as DailyActivityStat).label : (d as WeeklyActivityStat).week_start}
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
                ? { value: goal.goal_weight_kg, label: `Goal: ${goal.goal_weight_kg.toFixed(1)} kg` }
                : undefined
            }
            referenceColor="#22c55e"
          />
        </ChartCard>
      )}

      {/* Apple Health vitals */}
      {health && health.series.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <Heart size={18} className="text-red-400" weight="fill" />
            <h3 className="text-sm font-semibold">Apple Health</h3>
          </div>
          {health.series
            .filter((s) => s.metric !== "sleep_analysis" && s.metric !== "heart_rate")
            .map((s) => {
              const merged =
                s.metric === "apple_exercise_time"
                  ? combineHealthSeries(s, appMinByDate)
                  : s.metric === "active_energy"
                  ? combineHealthSeries(s, appKcalByDate)
                  : s;
              return <HealthTrendChart key={s.metric} series={merged} />;
            })}
          <AppleHealthCharts series={health.series} weightEntries={weightEntries} />
        </>
      )}

      <MetricNamesDiagnostic />
    </div>
  );
}