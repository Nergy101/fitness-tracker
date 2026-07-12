import { useEffect, useState } from "react";
import {
  BarbellIcon as Barbell,
  CalendarBlankIcon as CalendarBlank,
  CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp,
  ChartBarIcon as ChartBar,
  ChartPieSliceIcon as ChartPieSlice,
  ConfettiIcon as Confetti,
  FireIcon as Fire,
  FlagBannerIcon as FlagBanner,
  FlameIcon as Flame,
  FootprintsIcon as Footprints,
  HandFistIcon as HandFist,
  HeartIcon as Heart,
  MoonIcon as Moon,
  PersonSimpleRunIcon as PersonSimpleRun,
  PulseIcon as Pulse,
  RocketLaunchIcon as RocketLaunch,
  RulerIcon as Ruler,
  ScalesIcon as Scales,
  SmileyIcon as Smiley,
  SneakerIcon as Sneaker,
  TimerIcon as Timer,
  TrendDownIcon as TrendDown,
  TrendUpIcon as TrendUp,
  TrophyIcon as Trophy,
  WarningIcon as Warning,
  type Icon,
} from "@phosphor-icons/react";
import {
  api,
  type BmiResponse,
  type BoxingStatsResponse,
  type BoxingPrsResponse,
  type DailyActivityPoint,
  type GoalProgressResponse,
  type HealthInsightsResponse,
  type HealthSeries,
  type PrsResponse,
  type RunEntryResponse,
  type StatsOverviewResponse,
  type WeeklyActivityStat,
  type WeightEntryResponse,
  type WorkoutSession,
} from "../api";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityKind } from "../activity";
import ActivityLegend from "./ActivityLegend";
import ChartCard from "./ChartCard";
import LoadingSpinner from "./LoadingSpinner";
import AppleHealthCharts from "./health/AppleHealthCharts";
import MetricNamesDiagnostic from "./health/MetricNamesDiagnostic";
import MeasurementsSection from "./health/MeasurementsSection";
import SimpleChart from "./health/SimpleChart";
import { niceTicks } from "./health/ticks"
import { combineHealthSeries, shortDate } from "./health/utils";
import WellnessSection from "./health/WellnessSection";
import { formatDuration, formatHours } from "../format";

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

function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-green-400";
    case "Underweight": return "text-yellow-400";
    case "Overweight": return "text-orange-400";
    case "Obese": return "text-red-400";
    default: return "text-fg/50";
  }
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
  const w = gutter + Math.max(wPerBar * data.length, wPerBar);
  const ticks = [max, max / 2];

  return (
    <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full" style={{ maxHeight: height + 20 }}>
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

// ─── Health Trend Card ─────────────────────────────────────

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

// ─── Personal Records ──────────────────────────────────────

function RecordGroup({
  kind,
  records,
}: {
  kind: ActivityKind;
  records: { label: string; value: string | null }[];
}) {
  const filled = records.filter((r): r is { label: string; value: string } => r.value != null);
  if (filled.length === 0) return null;
  const KindIcon = ACTIVITY_ICONS[kind];
  return (
    <div className="mb-3 last:mb-0">
      <p className="flex items-center gap-1.5 text-xs text-fg/40 mb-1.5">
        <KindIcon size={14} className="shrink-0" style={{ color: ACTIVITY_COLORS[kind] }} />
        {ACTIVITY_LABELS[kind]}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {filled.map((r) => (
          <div key={r.label} className="bg-bg rounded-lg p-2">
            <p className="text-fg/50">{r.label}</p>
            <p className="text-sm font-bold text-fg">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalRecordsCard({ prs, boxingPrs }: { prs: PrsResponse; boxingPrs: BoxingPrsResponse | null }) {
  const runRecords = [
    { label: "Longest (distance)", value: prs.longest_run_km ? `${prs.longest_run_km.toFixed(1)} km` : null },
    { label: "Longest (time)", value: prs.longest_run_seconds ? formatDuration(prs.longest_run_seconds) : null },
    { label: "Fastest 5K", value: prs.fastest_5k_seconds ? formatDuration(prs.fastest_5k_seconds) : null },
    { label: "Fastest 10K", value: prs.fastest_10k_seconds ? formatDuration(prs.fastest_10k_seconds) : null },
    { label: "Best pace", value: prs.best_pace_seconds_per_km ? `${formatDuration(Math.round(prs.best_pace_seconds_per_km))} /km` : null },
    { label: "Most kcal", value: prs.most_kcal_run ? `${Math.round(prs.most_kcal_run)} kcal` : null },
    { label: "Best week", value: prs.best_week_run_km ? `${prs.best_week_run_km.toFixed(1)} km` : null },
  ];
  const walkRecords = [
    { label: "Longest (distance)", value: prs.longest_walk_km ? `${prs.longest_walk_km.toFixed(1)} km` : null },
    { label: "Longest (time)", value: prs.longest_walk_seconds ? formatDuration(prs.longest_walk_seconds) : null },
    { label: "Most kcal", value: prs.most_kcal_walk ? `${Math.round(prs.most_kcal_walk)} kcal` : null },
  ];
  const workoutRecords = [
    { label: "Longest (time)", value: prs.longest_workout_seconds ? formatDuration(prs.longest_workout_seconds) : null },
    { label: "Most kcal", value: prs.most_kcal_workout ? `${Math.round(prs.most_kcal_workout)} kcal` : null },
    { label: "Most exercises", value: prs.most_exercises_workout ? String(prs.most_exercises_workout) : null },
  ];
  const boxingRecords = boxingPrs ? [
    { label: "Longest session", value: boxingPrs.longest_session_seconds ? formatDuration(boxingPrs.longest_session_seconds) : null },
    { label: "Most kcal", value: boxingPrs.most_kcal_session ? `${Math.round(boxingPrs.most_kcal_session)} kcal` : null },
    { label: "Most rounds", value: boxingPrs.most_rounds_session ? String(boxingPrs.most_rounds_session) : null },
    { label: "Total hours", value: boxingPrs.total_hours_all_time > 0 ? `${boxingPrs.total_hours_all_time} hr` : null },
  ] : [];

  const hasAny =
    [...runRecords, ...walkRecords, ...workoutRecords, ...boxingRecords].some((r) => r.value != null);
  if (!hasAny) return null;

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={20} className="text-yellow-400 shrink-0" weight="fill" />
        <p className="text-sm font-semibold text-fg">Personal Records</p>
      </div>
      <RecordGroup kind="run" records={runRecords} />
      <RecordGroup kind="walk" records={walkRecords} />
      <RecordGroup kind="workout" records={workoutRecords} />
      {boxingRecords.some((r) => r.value != null) && (
        <div className="mb-3 last:mb-0">
          <p className="flex items-center gap-1.5 text-xs text-fg/40 mb-1.5">
            <HandFist size={14} className="shrink-0 text-red-400" />
            Boxing
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {boxingRecords.filter((r): r is { label: string; value: string } => r.value != null).map((r) => (
              <div key={r.label} className="bg-bg rounded-lg p-2">
                <p className="text-fg/50">{r.label}</p>
                <p className="text-sm font-bold text-fg">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Common shape for chart datum fields shared by WeeklyActivityStat and DailyActivityStat. */
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

/** Compute 7-day daily activity from sessions + runs (always fills all 7 days). */
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
  // Aggregate sessions
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
  // Aggregate runs (for distance and minutes not already captured as sessions)
  for (const r of runs) {
    const key = r.date.slice(0, 10);
    const entry = days.find((x) => x.date === key);
    if (!entry) continue;
    const kind: "run" | "walk" = r.run_type === "walk" ? "walk" : "run";
    entry[`${kind}_km`] += r.distance_km;
    if (entry[`${kind}_minutes`] === 0) {
      entry[`${kind}_minutes`] = r.duration_seconds / 60;
    }
    // Estimate kcal from distance (60 kcal/km run, 45 kcal/km walk)
    entry[`${kind}_kcal`] += r.distance_km * (kind === "run" ? 60 : 45);
  }
  return days;
}

// ─── Main Component ─────────────────────────────────────────

export default function HealthAndStatsTab() {
  // Stats data
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [runs, setRuns] = useState<RunEntryResponse[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntryResponse[]>([]);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);
  const [health, setHealth] = useState<HealthInsightsResponse | null>(null);
  const [activity, setActivity] = useState<DailyActivityPoint[]>([]);

  // Health data
  const [weights, setWeights] = useState<WeightEntryResponse[]>([]);
  const [bmi, setBmi] = useState<BmiResponse | null>(null);
  const [prs, setPrs] = useState<PrsResponse | null>(null);
  const [boxingStats, setBoxingStats] = useState<BoxingStatsResponse | null>(null);
  const [boxingPrs, setBoxingPrs] = useState<BoxingPrsResponse | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [showWellness, setShowWellness] = useState(false);
  const [showMeas, setShowMeas] = useState(false);
  const [chartMode, setChartMode] = useState<"daily" | "weekly">("daily");

  const loadAll = async () => {
    try {
      const [
        overview, runList, sessionList, wEntries, goalProgress, healthInsights,
        ws, b, pr, dailyActivity,
      ] = await Promise.all([
        api.getStatsOverview(),
        api.getRuns().catch(() => [] as RunEntryResponse[]),
        api.getSessions().catch(() => [] as WorkoutSession[]),
        api.getWeightEntries().catch(() => [] as WeightEntryResponse[]),
        api.getGoalProgress().catch(() => null),
        api.getHealthInsights(120).catch(() => null),
        api.getWeightEntries(),
        api.getBmi(),
        api.getPrs(),
        api.getDailyActivity(120).catch(() => null),
      ]);
      const boxStats = await api.getBoxingStats().catch(() => null);
      const boxPrs = await api.getBoxingPrs().catch(() => null);
      setStats(overview);
      setRuns(runList);
      setSessions(sessionList);
      setWeightEntries(wEntries);
      setGoal(goalProgress);
      setHealth(healthInsights);
      setWeights(ws);
      setBmi(b);
      setPrs(pr);
      setActivity(dailyActivity?.days ?? []);
      setBoxingStats(boxStats);
      setBoxingPrs(boxPrs);
    } catch (e) {
      console.error("Failed to load health & stats data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const logWeight = async () => {
    const kg = parseFloat(newWeight);
    if (isNaN(kg) || kg <= 0) return;
    await api.createWeightEntry({ weight_kg: kg });
    setNewWeight("");
    loadAll();
  };

  const deleteWeight = async (id: number) => {
    await api.deleteWeightEntry(id);
    loadAll();
  };

  if (loading) {
    return <LoadingSpinner label="Loading health data" />;
  }
  if (!stats) {
    return <div className="text-center py-8 text-fg/40">Failed to load data.</div>;
  }

  const weeks = [...stats.activity_weekly].reverse(); // oldest → newest
  const daily = computeDailyActivity(sessions, runs);
  const chartData = chartMode === "daily" ? daily : weeks;
  const hasDistance = chartData.some((d: ChartDatum) => (d.run_km || 0) + (d.walk_km || 0) > 0);
  const hasKcal = chartData.some((d: ChartDatum) => (d.workout_kcal || 0) + (d.run_kcal || 0) + (d.walk_kcal || 0) + (d.boxing_kcal || 0) > 0);
  const mixWeeks = weeks.slice(-4);

  // Pace trend
  const pacedRuns = runs
    .filter((r) => r.run_type !== "walk" && r.pace_per_km != null && r.distance_km >= 1)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);
  const bestPace = pacedRuns.length > 0 ? Math.min(...pacedRuns.map((r) => r.pace_per_km as number)) : null;

  // Weight journey
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

  {
    const strength = mixWeeks.reduce((s, w) => s + w.workout_minutes, 0);
    const cardio = mixWeeks.reduce((s, w) => s + w.run_minutes + w.walk_minutes + w.boxing_minutes, 0);
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

  if (stats.total_sessions_all === 0 && stats.total_runs === 0 && stats.total_walks === 0 && stats.total_boxing === 0) {
    insightLines.push({ icon: RocketLaunch, text: "Complete your first workout to see stats!" });
  }

  const appMinByDate = new Map(
    activity.filter((d) => d.minutes > 0).map((d) => [d.date, d.minutes] as const),
  );
  const appKcalByDate = new Map(
    activity.filter((d) => d.kcal > 0).map((d) => [d.date, d.kcal] as const),
  );

  return (
    <div className="health-stats-tab space-y-4">
      {/* ── Quick Stats: consistency, kcal, weight trend, streak ── */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<CalendarBlank size={14} className="text-accent" />}
          label="Consistency (30d)"
          value={`${stats?.consistency_score_pct ?? 0}%`}
        />
        <StatCard
          icon={<Fire size={14} className="text-orange-400" />}
          label="Total kcal (30d)"
          value={(stats?.total_kcal_burned ?? 0).toLocaleString()}
        />
        <StatCard
          icon={<Scales size={14} className="text-purple-400" />}
          label="Weight chg (30d)"
          value={
            stats?.avg_weight_change_kg != null
              ? `${stats.avg_weight_change_kg > 0 ? "+" : ""}${stats.avg_weight_change_kg.toFixed(1)} kg`
              : "—"
          }
        />
        {prs && prs.streak_days_30d > 0 ? (
          <StatCard
            icon={<Flame size={14} className="text-orange-400" weight="fill" />}
            label="Activity Streak (30d)"
            value={`${prs.streak_days_30d} days`}
          />
        ) : (
          <StatCard
            icon={<Flame size={14} className="text-fg/30" weight="fill" />}
            label="Activity Streak (30d)"
            value="—"
            sub="no activity yet"
          />
        )}
      </div>

      {/* ── TOP: Goal Progress + BMI + Log Weight ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Goal Progress */}
        <div className="bg-surface rounded-xl p-4 border border-fg/5 col-span-3 sm:col-span-1">
          {goal?.goal_weight_kg ? (
            <>
              <p className="text-xs text-fg/40 mb-2 flex items-center gap-1.5">
                <FlagBanner size={14} className="text-accent shrink-0" />
                Goal Progress</p>
              <div className="w-full bg-bg rounded-full h-3 mb-2">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${Math.min(goal.progress_percentage ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-fg/50">{goal.current_weight_kg?.toFixed(1)} kg</span>
                <span className="text-accent font-semibold">{goal.progress_percentage?.toFixed(0)}%</span>
                <span className="text-fg/50">Goal: {goal.goal_weight_kg} kg</span>
              </div>
              {goal.remaining_kg != null && (
                <p className="text-xs text-fg/40 mt-1">
                  {(goal.progress_percentage ?? 0) >= 100 ? (
                    <span className="inline-flex items-center gap-1">
                      Goal reached! <Confetti size={14} weight="fill" className="text-accent" />
                    </span>
                  ) : (
                    `${Math.abs(goal.remaining_kg).toFixed(1)} kg to go`
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-fg/30">Set a goal weight in Settings</p>
          )}
        </div>

        {/* BMI */}
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          {bmi?.bmi ? (
            <>
              <p className="text-xs text-fg/40 mb-1 flex items-center gap-1.5">
                <Ruler size={14} className={`${bmiColor(bmi.category)} shrink-0`} />
                BMI</p>
              <p className={`text-2xl font-bold ${bmiColor(bmi.category)}`}>{bmi.bmi}</p>
              <p className={`text-xs mt-0.5 ${bmiColor(bmi.category)}`}>{bmi.category}</p>
            </>
          ) : (
            <p className="text-xs text-fg/30">{bmi?.message || "Log weight for BMI"}</p>
          )}
        </div>

        {/* Log Weight */}
        <div className="bg-surface rounded-xl p-4 border border-fg/5 col-span-2 sm:col-span-1">
          <p className="text-xs text-fg/40 mb-2 flex items-center gap-1.5">
            <Scales size={14} className="text-accent shrink-0" />
            Log Weight</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="kg"
              className="flex-1 bg-bg border border-fg/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent/50 w-0"
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
            />
            <button
              onClick={logWeight}
              disabled={!newWeight}
              className="bg-accent text-bg rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              Log
            </button>
          </div>
        </div>
      </div>

      {/* ── PERSONAL RECORDS ── */}
      {prs && <PersonalRecordsCard prs={prs} boxingPrs={boxingPrs} />}

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={<Barbell size={14} style={{ color: ACTIVITY_COLORS.workout }} />}
          label="Total workouts"
          value={String(stats.total_sessions_all)}
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
        <StatCard
          icon={<HandFist size={14} style={{ color: ACTIVITY_COLORS.boxing }} />}
          label="Total boxing"
          value={String(stats.total_boxing)}
        />
      </div>

      {/* ── Boxing Stats ── */}
      {boxingStats && boxingStats.total_sessions > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-2 mb-3">
            <HandFist size={20} className="text-red-400 shrink-0" weight="fill" />
            <p className="text-sm font-semibold text-fg">Boxing</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard
              icon={<HandFist size={14} className="text-red-400" />}
              label="Sessions"
              value={String(boxingStats.total_sessions)}
            />
            <StatCard
              icon={<Timer size={14} className="text-red-400" />}
              label="Total hours"
              value={`${boxingStats.total_hours}h`}
            />
            <StatCard
              icon={<Timer size={14} className="text-red-400" />}
              label="Avg session"
              value={boxingStats.avg_duration_seconds ? `${Math.round(boxingStats.avg_duration_seconds / 60)}m` : "—"}
            />
            <StatCard
              icon={<Fire size={14} className="text-orange-400" />}
              label="Total kcal"
              value={Math.round(boxingStats.total_kcal_estimated).toLocaleString()}
              sub={boxingStats.avg_kcal_per_min ? `${boxingStats.avg_kcal_per_min.toFixed(1)} kcal/min` : undefined}
            />
            {boxingStats.avg_rounds != null && (
              <StatCard
                icon={<HandFist size={14} className="text-red-400" />}
                label="Avg rounds"
                value={String(boxingStats.avg_rounds)}
              />
            )}
          </div>
          {boxingStats.monthly_breakdown.length > 0 && (
            <div className="mt-3 pt-3 border-t border-fg/5">
              <p className="text-xs text-fg/40 mb-2">Monthly</p>
              <div className="space-y-1.5">
                {boxingStats.monthly_breakdown.map((m) => (
                  <div key={m.month} className="flex items-center justify-between text-xs">
                    <span className="text-fg/60">{m.month}</span>
                    <span className="text-fg/40">{m.sessions} sessions · {m.total_minutes} min{m.total_rounds > 0 ? ` · ${m.total_rounds} rounds` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRAPHS ── */}

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
                ? { value: goal.goal_weight_kg, label: `goal ${goal.goal_weight_kg.toFixed(1)} kg` }
                : undefined
            }
          />
        </ChartCard>
      )}

      {/* Recent weights + trend */}
      {weights.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <p className="text-xs text-fg/40 mb-2">Recent Weights</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {weights.slice(0, 20).map((w) => (
              <div key={w.id} className="flex items-center justify-between py-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{w.weight_kg.toFixed(1)} kg</span>
                    <span className="text-xs text-fg/40">{shortDate(w.date)}</span>
                  </div>
                  {w.notes && <p className="text-xs text-fg/30 truncate mt-0.5">{w.notes}</p>}
                </div>
                <button
                  onClick={() => deleteWeight(w.id)}
                  className="text-xs text-red-400/50 hover:text-red-400 shrink-0 ml-2"
                >
                  del
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {weights.length >= 2 && <SimpleChart entries={weights} />}

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

      {/* ── BODY MEASUREMENTS ── */}
      <button
        onClick={() => setShowMeas(!showMeas)}
        className="w-full bg-surface rounded-xl p-4 border border-fg/5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Ruler size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <span className="text-sm font-semibold text-fg">Body Measurements</span>
            <p className="text-[11px] text-fg/40 mt-0.5">Track waist, hips, arms, thighs and see changes over time</p>
          </div>
        </div>
        {showMeas ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>
      {showMeas && <MeasurementsSection />}

      {/* ── WELLNESS CHECK-IN ── */}
      <button
        onClick={() => setShowWellness(!showWellness)}
        className="w-full bg-surface rounded-xl p-4 border border-fg/5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Smiley size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <span className="text-sm font-semibold text-fg">Wellness Check-in</span>
            <p className="text-[11px] text-fg/40 mt-0.5">Log your mood, energy, stress, and sleep to spot trends</p>
          </div>
        </div>
        {showWellness ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>
      {showWellness && <WellnessSection />}
    </div>
  );
}