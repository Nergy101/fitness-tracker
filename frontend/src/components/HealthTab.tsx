import { useEffect, useState } from "react";
import {
  CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp,
  ConfettiIcon as Confetti,
  FlameIcon as Flame,
  RulerIcon as Ruler,
  SmileyIcon as Smiley,
  TrophyIcon as Trophy,
} from "@phosphor-icons/react";
import {
  api,
  type BmiResponse,
  type GoalProgressResponse,
  type StreakResponse,
  type WeightEntryResponse,
  type PrsResponse,
} from "../api";
import { formatDuration } from "../format";
import MeasurementsSection from "./health/MeasurementsSection";
import SimpleChart from "./health/SimpleChart";
import WellnessSection from "./health/WellnessSection";
import { shortDate } from "./health/utils";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityKind } from "../activity";

// ─── Helpers ───────────────────────────────────────────────

function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-green-400";
    case "Underweight": return "text-yellow-400";
    case "Overweight": return "text-orange-400";
    case "Obese": return "text-red-400";
    default: return "text-fg/50";
  }
}

function streakMsg(days: number): string {
  if (days >= 90) return "Legendary streak!";
  if (days >= 30) return "Month streak!";
  if (days >= 21) return "21 days — unstoppable!";
  if (days >= 14) return "Two weeks strong!";
  if (days >= 7) return "Week streak!";
  if (days >= 3) return "3-day streak!";
  if (days > 0) return `${days}-day streak`;
  return "Log today to start a streak!";
}

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

/** Activity-level personal records: runs / walks / workouts, color-coded
 *  like the History and Stats charts. */
function PersonalRecordsCard({ prs }: { prs: PrsResponse }) {
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

  const hasAny =
    [...runRecords, ...walkRecords, ...workoutRecords].some((r) => r.value != null) ||
    prs.longest_streak_days > 0;
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
      {prs.longest_streak_days > 0 && (
        <div className="flex items-center justify-between border-t border-fg/5 pt-2 mt-3">
          <p className="flex items-center gap-1.5 text-xs text-fg/50">
            <Flame size={14} className="text-orange-400 shrink-0" weight="fill" />
            Longest activity streak (2-day gap)
          </p>
          <p className="text-sm font-bold text-fg">
            {prs.longest_streak_days} day{prs.longest_streak_days === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function HealthTab() {
  // Data state
  const [weights, setWeights] = useState<WeightEntryResponse[]>([]);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);
  const [bmi, setBmi] = useState<BmiResponse | null>(null);
  const [prs, setPrs] = useState<PrsResponse | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [showWellness, setShowWellness] = useState(false);
  const [showMeas, setShowMeas] = useState(false);

  const loadAll = async () => {
    try {
      const [
        w, st, g, b, pr,
      ] = await Promise.all([
        api.getWeightEntries(),
        api.getWeightStreak(),
        api.getGoalProgress(),
        api.getBmi(),
        api.getPrs(),
      ]);
      setWeights(w);
      setStreak(st);
      setGoal(g);
      setBmi(b);
      setPrs(pr);
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
    return <div className="text-center py-8 text-fg/40">Loading health data...</div>;
  }

  return (
    <div className="health-tab space-y-4">
      {/* Header */}
      <h2 className="text-sm text-fg/50 font-medium">Your Health Overview</h2>

      {/* BMI + Weight Entry Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* BMI Card */}
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          {bmi?.bmi ? (
            <>
              <p className="text-xs text-fg/40 mb-1">BMI</p>
              <p className={`text-2xl font-bold ${bmiColor(bmi.category)}`}>{bmi.bmi}</p>
              <p className={`text-xs mt-0.5 ${bmiColor(bmi.category)}`}>{bmi.category}</p>
            </>
          ) : (
            <p className="text-xs text-fg/30">{bmi?.message || "Loading..."}</p>
          )}
        </div>

        {/* Quick Weight Log */}
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <p className="text-xs text-fg/40 mb-2">Log Weight</p>
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

      {/* Streak */}
      {streak && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {streak.current_streak >= 30 ? (
                <Trophy size={28} className="text-yellow-400 shrink-0" />
              ) : (
                <Flame size={28} className="text-orange-400 shrink-0" weight={streak.current_streak >= 7 ? "fill" : "regular"} />
              )}
              <div>
                <p className="text-xs text-fg/40 mb-0.5">Weight Logging Streak</p>
                <p className="text-sm font-semibold text-fg">{streakMsg(streak.current_streak)}</p>
                <p className="text-xs text-fg/40 mt-0.5">
                  Best: {streak.best_streak} days
                  {streak.last_logged_date && ` · Last: ${shortDate(streak.last_logged_date)}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Progress */}
      {goal?.goal_weight_kg && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <p className="text-xs text-fg/40 mb-2">Goal Progress</p>
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
        </div>
      )}

      {/* Personal Records */}
      {prs && <PersonalRecordsCard prs={prs} />}

      {/* Weight History */}
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

      {/* Weight Trend Chart */}
      {weights.length >= 2 && (
        <SimpleChart entries={weights} />
      )}


      {/* Body Measurements */}
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

      {/* Wellness Check-in */}
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
