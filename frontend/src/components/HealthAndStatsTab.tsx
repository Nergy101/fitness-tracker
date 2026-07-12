import { useEffect, useState } from "react";
import {
  BarbellIcon as Barbell,
  CalendarBlankIcon as CalendarBlank,
  CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp,
  ChartBarIcon as ChartBar,
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
  type StatsOverviewResponse,
  type WeightEntryResponse,
  type WorkoutSession,
} from "../api";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityKind } from "../activity";
import LoadingSpinner from "./LoadingSpinner";
import AppleHealthCharts from "./health/AppleHealthCharts";
import MetricNamesDiagnostic from "./health/MetricNamesDiagnostic";
import MeasurementsSection from "./health/MeasurementsSection";
import SimpleChart from "./health/SimpleChart";
import { activityStats, combineHealthSeries, shortDate, type ActivityStats } from "./health/utils";
import WellnessSection from "./health/WellnessSection";
import { formatDuration } from "../format";

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

function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-green-400";
    case "Underweight": return "text-yellow-400";
    case "Overweight": return "text-orange-400";
    case "Obese": return "text-red-400";
    default: return "text-fg/50";
  }
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

/** Per-activity all-time summary (Workouts / Running / Walking), mirroring the
 *  Boxing card layout. Driven by activityStats() over the full session list. */
function ActivityStatsCard({ kind, stats }: { kind: ActivityKind; stats: ActivityStats }) {
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
  const w = 300;
  const h = 90;
  const lo = Math.min(...values) * 0.9;
  const hi = Math.max(...values) * 1.1;
  const range = hi - lo || 1;
  const px = (i: number) => 24 + (i / (series.points.length - 1)) * (w - 30);
  const py = (v: number) => h - ((v - lo) / range) * h;
  const labelIdxs = [0, Math.floor((series.points.length - 1) / 2), series.points.length - 1];
  const overlay = ROLLING_AVG_METRICS.has(series.metric) ? rollingAvg(values, 7) : undefined;

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <MetricIcon size={16} style={{ color: meta.color }} />
        <span className="text-xs text-fg/40">{series.label}</span>
        <span className="text-[10px] text-fg/30 ml-auto">
          {formatHealthValue(series.metric, latest)} {series.unit} · avg {formatHealthValue(series.metric, avg)}
        </span>
      </div>
      {series.points.length >= 2 ? (
        <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" style={{ maxHeight: h + 18 }}>
          <polyline
            points={series.points.map((p, i) => `${px(i)},${py(p.value)}`).join(" ")}
            fill="none"
            stroke={meta.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {series.points.map((p, i) => (
            <circle key={i} cx={px(i)} cy={py(p.value)} r="2.5" fill={meta.color} />
          ))}
          {overlay && overlay.length === series.points.length && (
            <polyline
              points={overlay.map((v, i) => `${px(i)},${py(v)}`).join(" ")}
              fill="none"
              stroke={meta.color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={0.55}
            />
          )}
          {series.metric === "apple_exercise_time" && (
            <line
              x1={24} y1={py(30)} x2={w} y2={py(30)}
              stroke={meta.color} strokeWidth="1" strokeDasharray="4 3" opacity={0.45}
            />
          )}
          {labelIdxs.map((idx) => (
            <text key={idx} x={px(idx)} y={h + 13} textAnchor="middle" className="fill-fg/30" fontSize="8">
              {series.points[idx].date.slice(5)}
            </text>
          ))}
        </svg>
      ) : (
        <p className="text-[10px] text-fg/30 text-center py-2">
          More data needed for trend — keep syncing
        </p>
      )}
    </div>
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

// ─── Main Component ─────────────────────────────────────────

export default function HealthAndStatsTab() {
  // Stats data
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
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

  const loadAll = async () => {
    try {
      const [
        overview, sessionList, wEntries, goalProgress, healthInsights,
        ws, b, pr, dailyActivity,
      ] = await Promise.all([
        api.getStatsOverview(),
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
  const mixWeeks = weeks.slice(-4);
  const workoutStats = activityStats(sessions, "workout");
  const runStats = activityStats(sessions, "run");
  const walkStats = activityStats(sessions, "walk");

  const appMinByDate = new Map(
    activity.filter((d) => d.minutes > 0).map((d) => [d.date, d.minutes] as const),
  );
  const appKcalByDate = new Map(
    activity.filter((d) => d.kcal > 0).map((d) => [d.date, d.kcal] as const),
  );

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

      {/* ── Per-activity Stats (above Boxing) ── */}
      {workoutStats.sessions > 0 && (
        <ActivityStatsCard kind="workout" stats={workoutStats} />
      )}
      {runStats.sessions > 0 && (
        <ActivityStatsCard kind="run" stats={runStats} />
      )}
      {walkStats.sessions > 0 && (
        <ActivityStatsCard kind="walk" stats={walkStats} />
      )}

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