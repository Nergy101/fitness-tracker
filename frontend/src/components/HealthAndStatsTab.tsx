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
  HandFistIcon as HandFist,
  PersonSimpleRunIcon as PersonSimpleRun,
  RocketLaunchIcon as RocketLaunch,
  RulerIcon as Ruler,
  ScalesIcon as Scales,
  SmileyIcon as Smiley,
  SneakerIcon as Sneaker,
  TimerIcon as Timer,
  TrendDownIcon as TrendDown,
  TrendUpIcon as TrendUp,
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
  type PrsResponse,
  type StatsOverviewResponse,
  type WeightEntryResponse,
  type WorkoutSession,
} from "../api";
import { ACTIVITY_COLORS } from "../activity";
import { dayKey } from "../dateKey";
import { formatWeekLabel } from "../locale";
import { useLocale } from "../useLocale";
import { SINGLE_LETTER } from "./history/utils";
import HealthSkeleton from "./skeletons/HealthSkeleton";
import ChartCard from "./ChartCard";
import MeasurementsSection from "./health/MeasurementsSection";
import InjurySection from "./health/InjurySection";
import SimpleChart from "./health/SimpleChart";
import { activityStats, shortDate } from "./health/utils";
import WellnessSection from "./health/WellnessSection";
import { StatCard } from "./health/StatCard";
import { ActivityStatsCard } from "./health/ActivityStatsCard";
import { PersonalRecordsCard } from "./health/PersonalRecordsCard";

import { logger } from "../logger";
function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-[var(--tint-walk-fg)]";
    case "Underweight": return "text-[var(--tint-workout-fg)]";
    case "Overweight": return "text-[var(--tint-cycling-fg)]";
    case "Obese": return "text-[var(--tint-boxing-fg)]";
    default: return "text-fg/50";
  }
}

/** Sub-line under the consistency score. At 100% it reports how long the score
 *  has read 100% — the motivator. Below 100% the counter is 0 by definition, so
 *  say why instead. Unrelated to the Activity Streak card, which counts training
 *  days under the stricter one-rest-day rule. */
function consistencySub(stats: StatsOverviewResponse | null): string {
  const days = stats?.consistency_days_at_100 ?? 0;
  if (days > 0) return `100% for ${days} day${days === 1 ? "" : "s"}`;
  if ((stats?.consistency_score_pct ?? 0) > 0) return "a 3-day gap in the last 30d";
  return "log any activity to start";
}

// ─── Main Component ─────────────────────────────────────────

export default function HealthAndStatsTab() {
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const { locale } = useLocale();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);

  const [weights, setWeights] = useState<WeightEntryResponse[]>([]);
  const [bmi, setBmi] = useState<BmiResponse | null>(null);
  const [prs, setPrs] = useState<PrsResponse | null>(null);
  const [boxingStats, setBoxingStats] = useState<BoxingStatsResponse | null>(null);
  const [boxingPrs, setBoxingPrs] = useState<BoxingPrsResponse | null>(null);
  const [boxingTrends, setBoxingTrends] = useState<DailyActivityPoint[]>([]);
  const [boxingChartMode, setBoxingChartMode] = useState<"daily" | "weekly">("daily");
  const [cyclingTrends, setCyclingTrends] = useState<DailyActivityPoint[]>([]);
  const [cyclingChartMode, setCyclingChartMode] = useState<"daily" | "weekly">("daily");

  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [showWellness, setShowWellness] = useState(false);
  const [showMeas, setShowMeas] = useState(false);

  const loadAll = async () => {
    try {
      const [overview, sessionList, ws, b, pr] = await Promise.all([
        api.getStatsOverview(),
        api.getSessions().catch(() => [] as WorkoutSession[]),
        api.getWeightEntries(),
        api.getBmi(),
        api.getPrs(),
      ]);
      const boxStats = await api.getBoxingStats().catch(() => null);
      const boxPrs = await api.getBoxingPrs().catch(() => null);
      const boxTrends = await api.getBoxingTrends().catch(() => null);
      const cycTrends = await api.getCyclingTrends().catch(() => null);
      const goalProgress = await api.getGoalProgress().catch(() => null);
      setStats(overview);
      setSessions(sessionList);
      setWeights(ws);
      setBmi(b);
      setPrs(pr);
      setGoal(goalProgress);
      setBoxingStats(boxStats);
      setBoxingPrs(boxPrs);
      setBoxingTrends(boxTrends?.days ?? []);
      setCyclingTrends(cycTrends?.days ?? []);
    } catch (e) {
      logger.error("Failed to load health data", e);
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
    return <HealthSkeleton />;
  }
  if (!stats) {
    return <div className="text-center py-8 text-fg/40">Failed to load data.</div>;
  }

  const weeks = [...stats.activity_weekly].reverse();
  const mixWeeks = weeks.slice(-4);
  const workoutStats = activityStats(sessions, "workout");
  const runStats = activityStats(sessions, "run");
  const walkStats = activityStats(sessions, "walk");

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
    const cardio = mixWeeks.reduce((s, w) => s + w.run_minutes + w.walk_minutes + w.boxing_minutes + w.cycling_minutes, 0);
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

  if (stats.total_sessions_all === 0 && stats.total_runs === 0 && stats.total_walks === 0 && stats.total_boxing === 0 && stats.total_cycling === 0) {
    insightLines.push({ icon: RocketLaunch, text: "Complete your first workout to see stats!" });
  }

  return (
    <div className="health-stats-tab space-y-4 pb-24 [&_.bg-surface.rounded-2xl]:rounded-[26px]">
      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<CalendarBlank size={14} />}
          label="Consistency (30d)"
          tint="blue"
          value={`${stats?.consistency_score_pct ?? 0}%`}
          sub={consistencySub(stats)}
        />
        <StatCard
          icon={<Fire size={14} />}
          label="Total kcal (30d)"
          value={(stats?.total_kcal_burned ?? 0).toLocaleString()}
          tint="workout"
        />
        <StatCard
          icon={<Scales size={14} />}
          label="Weight chg (30d)"
          tint="cycling"
          value={
            stats?.avg_weight_change_kg != null
              ? `${stats.avg_weight_change_kg > 0 ? "+" : ""}${stats.avg_weight_change_kg.toFixed(1)} kg`
              : "—"
          }
        />
        {prs && prs.streak_days_30d > 0 ? (
          <StatCard
            icon={<Flame size={14} className="text-[var(--accent)]" weight="fill" />}
            label="Activity Streak (30d)"
            tint="workout"
            value={`${prs.streak_days_30d} days`}
          />
        ) : (
          <StatCard
            icon={<Flame size={14} weight="fill" />}
            label="Activity Streak (30d)"
            value="—"
            sub="no activity yet"
            tint="workout"
          />
        )}
      </div>

      {/* ── Goal Progress + BMI + Log Weight ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--tint-workout-bg)] text-[var(--tint-workout-fg)] rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)] col-span-3 sm:col-span-1">
          {goal?.goal_weight_kg ? (
            <>
              <p className="text-[10px] font-semibold tracking-wide text-current/75 mb-2 flex items-center gap-1.5">
                <FlagBanner size={14} className="text-accent shrink-0" />
                Goal Progress
              </p>
              <div className="w-full bg-[var(--tint-workout-chip)] rounded-full h-3 mb-2">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${Math.min(goal.progress_percentage ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-current/70 tabular-nums">{goal.current_weight_kg?.toFixed(1)} kg</span>
                <span className="text-accent font-semibold tabular-nums">{goal.progress_percentage?.toFixed(0)}%</span>
                <span className="text-current/70 tabular-nums">Goal: {goal.goal_weight_kg} kg</span>
              </div>
              {goal.remaining_kg != null && (
                <p className="text-xs text-current/75 mt-1">
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
            <p className="text-xs text-current/70">Set a goal weight in Settings</p>
          )}
        </div>

        <div className="bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)] rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)] col-span-3 sm:col-span-1 flex flex-col justify-between">
          {bmi?.bmi ? (
            <>
              <p className="text-[10px] font-semibold tracking-wide text-[var(--tint-blue-fg)] mb-1 flex items-center gap-1.5">
                <Ruler size={14} className={`${bmiColor(bmi.category)} shrink-0`} />
                BMI
              </p>
              <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${bmiColor(bmi.category)}`}>{bmi.bmi}</p>
              <p className={`text-xs mt-0.5 ${bmiColor(bmi.category)}`}>{bmi.category}</p>
            </>
          ) : (
            <p className="text-xs text-[var(--tint-blue-fg)]/80">{bmi?.message || "Log weight for BMI"}</p>
          )}
        </div>

        <div className="bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)] col-span-3 sm:col-span-1">
          <p className="text-[10px] font-semibold tracking-wide text-fg/45 mb-2 flex items-center gap-1.5">
            <Scales size={14} className="text-accent shrink-0" />
            Log Weight</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="kg"
              className="flex-1 min-h-11 bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50 w-0"
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
            />
            <button
              onClick={logWeight}
              disabled={!newWeight}
              className="bg-accent text-on-accent rounded-xl px-4 min-h-11 text-sm font-semibold shadow-[var(--shadow-sm)] active:scale-[0.98] transition disabled:opacity-50"
            >
              Log
            </button>
          </div>
        </div>
      </div>

      {/* ── Personal Records ── */}
      {prs && <PersonalRecordsCard prs={prs} boxingPrs={boxingPrs} />}

      {/* ── Coach insights ── */}
      {insightLines.length > 0 && (
        <div className="space-y-1.5">
          {insightLines.map(({ icon: InsightIcon, text, tone }, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-fg/70 bg-surface rounded-2xl px-4 py-3 border border-fg/5">
              <InsightIcon size={14} className={`shrink-0 ${tone === "warn" ? "text-[var(--tint-workout-fg)]" : "text-accent"}`} />
              {text}
            </p>
          ))}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={<Barbell size={14} />}
          label="Total workouts"
          value={String(stats.total_sessions_all)}
          tint="workout"
        />
        <StatCard
          icon={<PersonSimpleRun size={14} />}
          label="Total runs"
          value={String(stats.total_runs)}
          tint="run"
        />
        <StatCard
          icon={<Sneaker size={14} />}
          label="Total walks"
          value={String(stats.total_walks)}
          tint="walk"
        />
        <StatCard
          icon={<HandFist size={14} />}
          label="Total boxing"
          value={String(stats.total_boxing)}
          tint="boxing"
        />
      </div>

      {/* ── Per-activity Stats ── */}
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
        <div className="bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 mb-3">
            <HandFist size={20} className="text-[var(--tint-boxing-fg)] shrink-0" weight="fill" />
            <p className="text-sm font-bold tracking-tight text-fg">Boxing</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard tint="boxing" icon={<HandFist size={14} />} label="Sessions" value={String(boxingStats.total_sessions)} />
            <StatCard tint="boxing" icon={<Timer size={14} />} label="Total hours" value={`${boxingStats.total_hours}h`} />
            <StatCard tint="boxing" icon={<Timer size={14} />} label="Avg session" value={boxingStats.avg_duration_seconds ? `${Math.round(boxingStats.avg_duration_seconds / 60)}m` : "—"} />
            <StatCard
              tint="boxing"
              icon={<Fire size={14} className="text-[var(--accent)]" />}
              label="Total kcal"
              value={Math.round(boxingStats.total_kcal_estimated).toLocaleString()}
              sub={boxingStats.avg_kcal_per_min ? `${boxingStats.avg_kcal_per_min.toFixed(1)} kcal/min` : undefined}
            />
            {boxingStats.avg_rounds != null && (
              <StatCard tint="boxing" icon={<HandFist size={14} />} label="Avg rounds" value={String(boxingStats.avg_rounds)} />
            )}
          </div>
          {boxingStats.monthly_breakdown.length > 0 && (
            <div className="mt-3 pt-3 border-t border-fg/5">
              <p className="text-[10px] font-semibold tracking-wide text-fg/45 mb-2">Monthly</p>
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

      {/* ── Boxing Trend Charts ── */}
      {boxingTrends.length >= 2 && (() => {
        const DAYS = SINGLE_LETTER;
        const sorted = [...boxingTrends].sort((a, b) => a.date.localeCompare(b.date));

        // Daily view: last 7 days
        const now = new Date();
        const daily = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = dayKey(d);
          const match = sorted.find((p) => p.date === key);
          daily.push({
            label: DAYS[(d.getDay() + 6) % 7],
            minutes: match?.minutes ?? 0,
            kcal: match?.kcal ?? 0,
          });
        }

        // Weekly view: group by ISO week
        const weeklyMap = new Map<string, { minutes: number; kcal: number }>();
        for (const p of sorted) {
          const d = new Date(p.date + "T12:00:00");
          const mon = new Date(d);
          mon.setDate(d.getDate() - (d.getDay() + 6) % 7);
          const key = dayKey(mon);
          const w = weeklyMap.get(key) ?? { minutes: 0, kcal: 0 };
          w.minutes += p.minutes;
          w.kcal += p.kcal;
          weeklyMap.set(key, w);
        }
        const weekly = [...weeklyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([week, v]) => ({ label: formatWeekLabel(week, locale), minutes: v.minutes, kcal: v.kcal }));

        const data = boxingChartMode === "daily" ? daily : weekly;
        const hasData = data.some((d: { minutes: number; kcal: number }) => d.minutes > 0);

        const gutter = 28;
        const svgH = 80;
        const slot = 26;
        const svgW = gutter + Math.max(data.length, 1) * slot;
        const maxMin = Math.max(1, ...data.map((item) => item.minutes));
        const maxKcal = Math.max(1, ...data.map((item) => item.kcal));
        return hasData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-fg">Boxing Trends</span>
              <div className="ml-auto flex bg-surface rounded-full p-0.5 border border-fg/10" role="group" aria-label="Boxing chart scale">
                <button
                  onClick={() => setBoxingChartMode("daily")}
                  aria-pressed={boxingChartMode === "daily"}
                  className={`min-h-11 px-3 rounded-full text-xs font-medium transition-colors ${boxingChartMode === "daily" ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]" : "text-fg/50"}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setBoxingChartMode("weekly")}
                  aria-pressed={boxingChartMode === "weekly"}
                  className={`min-h-11 px-3 rounded-full text-xs font-medium transition-colors ${boxingChartMode === "weekly" ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]" : "text-fg/50"}`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Minutes chart */}
            <ChartCard
              icon={<Timer size={16} className="text-[var(--tint-boxing-fg)]" />}
              title={boxingChartMode === "daily" ? "Boxing Minutes (daily)" : "Boxing Minutes (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxMin, maxMin / 2].map((t) => {
                  const y = svgH - (t / maxMin) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {t >= 120 ? `${(t / 60).toFixed(1)}h` : `${Math.round(t)}m`}
                      </text>
                    </g>
                  );
                })}
                <line x1={gutter} y1={svgH} x2={svgW} y2={svgH} className="stroke-fg/10" strokeWidth="0.5" />
                {data.map((d: { label: string; minutes: number }, i: number) => {
                  const x = gutter + i * slot + 2;
                  const h = Math.max((d.minutes / maxMin) * svgH, 1);
                  return (
                    <g key={i}>
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={3} fill="var(--tint-boxing-fg)" opacity={0.85} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ChartCard>

            {/* Kcal chart */}
            <ChartCard
              icon={<Fire size={16} className="text-[var(--accent)]" />}
              title={boxingChartMode === "daily" ? "Boxing kcal (daily)" : "Boxing kcal (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxKcal, maxKcal / 2].map((t) => {
                  const y = svgH - (t / maxKcal) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(Math.round(t))}
                      </text>
                    </g>
                  );
                })}
                <line x1={gutter} y1={svgH} x2={svgW} y2={svgH} className="stroke-fg/10" strokeWidth="0.5" />
                {data.map((d: { label: string; kcal: number }, i: number) => {
                  const x = gutter + i * slot + 2;
                  const h = Math.max((d.kcal / maxKcal) * svgH, 1);
                  return (
                    <g key={i}>
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={3} fill="var(--tint-boxing-fg)" opacity={0.85} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ChartCard>
          </div>
        ) : null;
      })()}

      {/* ── Cycling Trend Charts ── */}
      {cyclingTrends.length >= 2 && (() => {
        const DAYS = SINGLE_LETTER;
        const sorted = [...cyclingTrends].sort((a, b) => a.date.localeCompare(b.date));

        // Daily view: last 7 days
        const now = new Date();
        const daily = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = dayKey(d);
          const match = sorted.find((p) => p.date === key);
          daily.push({
            label: DAYS[(d.getDay() + 6) % 7],
            minutes: match?.minutes ?? 0,
            kcal: match?.kcal ?? 0,
          });
        }

        // Weekly view: group by ISO week
        const weeklyMap = new Map<string, { minutes: number; kcal: number }>();
        for (const p of sorted) {
          const d = new Date(p.date + "T12:00:00");
          const mon = new Date(d);
          mon.setDate(d.getDate() - (d.getDay() + 6) % 7);
          const key = dayKey(mon);
          const w = weeklyMap.get(key) ?? { minutes: 0, kcal: 0 };
          w.minutes += p.minutes;
          w.kcal += p.kcal;
          weeklyMap.set(key, w);
        }
        const weekly = [...weeklyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([week, v]) => ({ label: formatWeekLabel(week, locale), minutes: v.minutes, kcal: v.kcal }));

        const data = cyclingChartMode === "daily" ? daily : weekly;
        const hasData = data.some((d: { minutes: number; kcal: number }) => d.minutes > 0);

        const gutter = 28;
        const svgH = 80;
        const slot = 26;
        const svgW = gutter + Math.max(data.length, 1) * slot;
        const maxMin = Math.max(1, ...data.map((item) => item.minutes));
        const maxKcal = Math.max(1, ...data.map((item) => item.kcal));
        return hasData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-fg">Cycling Trends</span>
              <div className="ml-auto flex bg-surface rounded-full p-0.5 border border-fg/10" role="group" aria-label="Cycling chart scale">
                <button
                  onClick={() => setCyclingChartMode("daily")}
                  aria-pressed={cyclingChartMode === "daily"}
                  className={`min-h-11 px-3 rounded-full text-xs font-medium transition-colors ${cyclingChartMode === "daily" ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]" : "text-fg/50"}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setCyclingChartMode("weekly")}
                  aria-pressed={cyclingChartMode === "weekly"}
                  className={`min-h-11 px-3 rounded-full text-xs font-medium transition-colors ${cyclingChartMode === "weekly" ? "bg-accent text-on-accent shadow-[var(--shadow-sm)]" : "text-fg/50"}`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Minutes chart */}
            <ChartCard
              icon={<Timer size={16} className="text-[var(--tint-cycling-fg)]" />}
              title={cyclingChartMode === "daily" ? "Cycling Minutes (daily)" : "Cycling Minutes (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxMin, maxMin / 2].map((t) => {
                  const y = svgH - (t / maxMin) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {t >= 120 ? `${(t / 60).toFixed(1)}h` : `${Math.round(t)}m`}
                      </text>
                    </g>
                  );
                })}
                <line x1={gutter} y1={svgH} x2={svgW} y2={svgH} className="stroke-fg/10" strokeWidth="0.5" />
                {data.map((d: { label: string; minutes: number }, i: number) => {
                  const x = gutter + i * slot + 2;
                  const h = Math.max((d.minutes / maxMin) * svgH, 1);
                  return (
                    <g key={i}>
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={3} fill={ACTIVITY_COLORS.cycling} opacity={0.85} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ChartCard>

            {/* Kcal chart */}
            <ChartCard
              icon={<Fire size={16} className="text-[var(--accent)]" />}
              title={cyclingChartMode === "daily" ? "Cycling kcal (daily)" : "Cycling kcal (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxKcal, maxKcal / 2].map((t) => {
                  const y = svgH - (t / maxKcal) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/[0.07]" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(Math.round(t))}
                      </text>
                    </g>
                  );
                })}
                <line x1={gutter} y1={svgH} x2={svgW} y2={svgH} className="stroke-fg/10" strokeWidth="0.5" />
                {data.map((d: { label: string; kcal: number }, i: number) => {
                  const x = gutter + i * slot + 2;
                  const h = Math.max((d.kcal / maxKcal) * svgH, 1);
                  return (
                    <g key={i}>
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={3} fill={ACTIVITY_COLORS.cycling} opacity={0.85} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/35" fontSize="8" fontWeight="600">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ChartCard>
          </div>
        ) : null;
      })()}

      {/* Recent weights + trend */}
      {weights.length > 0 && (
        <div className="bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)]">
          <p className="text-[10px] font-semibold tracking-wide text-fg/45 mb-2">Recent Weights</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {weights.slice(0, 20).map((w) => (
              <div key={w.id} className="flex items-center justify-between py-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg tabular-nums">{w.weight_kg.toFixed(1)} kg</span>
                    <span className="text-xs text-fg/40">{shortDate(w.date)}</span>
                  </div>
                  {w.notes && <p className="text-xs text-fg/30 truncate mt-0.5">{w.notes}</p>}
                </div>
                <button
                  onClick={() => deleteWeight(w.id)}
                  className="w-11 h-11 flex items-center justify-center text-xs text-[var(--tint-boxing-fg)] shrink-0 ml-2 rounded-full hover:bg-[var(--tint-boxing-bg)] transition-colors"
                >
                  del
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {weights.length >= 2 && <SimpleChart entries={weights} />}

      {/* ── Injury Timeline ── */}
      <InjurySection />

      {/* ── Body Measurements ── */}
      <button
        onClick={() => setShowMeas(!showMeas)}
        aria-expanded={showMeas}
        className="w-full min-h-16 bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)] flex items-center justify-between hover:bg-fg/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Ruler size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <span className="text-sm font-bold tracking-tight text-fg">Body Measurements</span>
            <p className="text-[11px] text-fg/40 mt-0.5">Track waist, hips, arms, thighs and see changes over time</p>
          </div>
        </div>
        {showMeas ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>
      {showMeas && <MeasurementsSection />}

      {/* ── Wellness Check-in ── */}
      <button
        onClick={() => setShowWellness(!showWellness)}
        aria-expanded={showWellness}
        className="w-full min-h-16 bg-surface rounded-[26px] p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)] flex items-center justify-between hover:bg-fg/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Smiley size={22} className="text-accent shrink-0" />
          <div className="text-left">
            <span className="text-sm font-bold tracking-tight text-fg">Wellness Check-in</span>
            <p className="text-[11px] text-fg/40 mt-0.5">Log your mood, energy, stress, and sleep to spot trends</p>
          </div>
        </div>
        {showWellness ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>
      {showWellness && <WellnessSection />}
    </div>
  );
}