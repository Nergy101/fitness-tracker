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
import LoadingSpinner from "./LoadingSpinner";
import ChartCard from "./ChartCard";
import MeasurementsSection from "./health/MeasurementsSection";
import SimpleChart from "./health/SimpleChart";
import { activityStats, shortDate } from "./health/utils";
import WellnessSection from "./health/WellnessSection";
import { StatCard } from "./health/StatCard";
import { ActivityStatsCard } from "./health/ActivityStatsCard";
import { PersonalRecordsCard } from "./health/PersonalRecordsCard";

function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-green-400";
    case "Underweight": return "text-yellow-400";
    case "Overweight": return "text-orange-400";
    case "Obese": return "text-red-400";
    default: return "text-fg/50";
  }
}

// ─── Main Component ─────────────────────────────────────────

export default function HealthAndStatsTab() {
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);

  const [weights, setWeights] = useState<WeightEntryResponse[]>([]);
  const [bmi, setBmi] = useState<BmiResponse | null>(null);
  const [prs, setPrs] = useState<PrsResponse | null>(null);
  const [boxingStats, setBoxingStats] = useState<BoxingStatsResponse | null>(null);
  const [boxingPrs, setBoxingPrs] = useState<BoxingPrsResponse | null>(null);
  const [boxingTrends, setBoxingTrends] = useState<DailyActivityPoint[]>([]);
  const [boxingChartMode, setBoxingChartMode] = useState<"daily" | "weekly">("daily");

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
    } catch (e) {
      console.error("Failed to load health data", e);
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
    <div className="health-stats-tab space-y-4 mx-auto w-full max-w-2xl">
      {/* ── Quick Stats ── */}
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

      {/* ── Goal Progress + BMI + Log Weight ── */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* ── Personal Records ── */}
      {prs && <PersonalRecordsCard prs={prs} boxingPrs={boxingPrs} />}

      {/* ── Coach insights ── */}
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

      {/* ── Summary cards ── */}
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

      {/* ── Boxing Trend Charts ── */}
      {boxingTrends.length >= 2 && (() => {
        const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
        const sorted = [...boxingTrends].sort((a, b) => a.date.localeCompare(b.date));

        // Daily view: last 7 days
        const now = new Date();
        const daily = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
          const key = mon.toISOString().slice(0, 10);
          const w = weeklyMap.get(key) ?? { minutes: 0, kcal: 0 };
          w.minutes += p.minutes;
          w.kcal += p.kcal;
          weeklyMap.set(key, w);
        }
        const weekly = [...weeklyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([week, v]) => ({ label: week.slice(5), minutes: v.minutes, kcal: v.kcal }));

        const data = boxingChartMode === "daily" ? daily : weekly;
        const hasData = data.some((d: { minutes: number; kcal: number }) => d.minutes > 0);

        const barW = 20;
        const gutter = 28;
        const svgH = 80;
        const svgW = Math.max(300, gutter + barW * data.length);
        const slot = (svgW - gutter) / data.length;
        const maxMin = Math.max(1, ...data.map((d: { minutes: number }) => d.minutes));
        const maxKcal = Math.max(1, ...data.map((d: { kcal: number }) => d.kcal));

        return hasData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-fg/60">Boxing Trends</span>
              <div className="ml-auto flex bg-surface rounded-full p-0.5 border border-fg/10">
                <button
                  onClick={() => setBoxingChartMode("daily")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${boxingChartMode === "daily" ? "bg-accent text-on-accent" : "text-fg/50"}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setBoxingChartMode("weekly")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${boxingChartMode === "weekly" ? "bg-accent text-on-accent" : "text-fg/50"}`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Minutes chart */}
            <ChartCard
              icon={<Timer size={16} className="text-red-400" />}
              title={boxingChartMode === "daily" ? "Boxing Minutes (daily)" : "Boxing Minutes (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxMin, maxMin / 2].map((t) => {
                  const y = svgH - (t / maxMin) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/30" fontSize="8">
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
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={2} fill={ACTIVITY_COLORS.boxing} opacity={0.7} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/30" fontSize="8">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </ChartCard>

            {/* Kcal chart */}
            <ChartCard
              icon={<Fire size={16} className="text-orange-400" />}
              title={boxingChartMode === "daily" ? "Boxing kcal (daily)" : "Boxing kcal (weekly)"}
            >
              <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} className="w-full">
                {[maxKcal, maxKcal / 2].map((t) => {
                  const y = svgH - (t / maxKcal) * svgH;
                  return (
                    <g key={t}>
                      <line x1={gutter} y1={y} x2={svgW} y2={y} className="stroke-fg/10" strokeWidth="0.5" strokeDasharray="2 3" />
                      <text x={gutter - 4} y={Math.max(y + 3, 7)} textAnchor="end" className="fill-fg/30" fontSize="8">
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
                      <rect x={x} y={svgH - h} width={slot - 4} height={h} rx={2} fill={ACTIVITY_COLORS.boxing} opacity={0.7} />
                      <text x={x + (slot - 4) / 2} y={svgH + 12} textAnchor="middle" className="fill-fg/30" fontSize="8">
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

      {/* ── Body Measurements ── */}
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

      {/* ── Wellness Check-in ── */}
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