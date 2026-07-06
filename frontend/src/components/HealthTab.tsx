import { useEffect, useState } from "react";
import {
  CaretDownIcon as CaretDown,
  CaretUpIcon as CaretUp,
  ConfettiIcon as Confetti,
  FlameIcon as Flame,
  GearIcon as Gear,
  RulerIcon as Ruler,
  SmileyIcon as Smiley,
  TrophyIcon as Trophy,
} from "@phosphor-icons/react";
import {
  api,
  type BmiResponse,
  type GoalProgressResponse,
  type HealthScoreResponse,
  type StreakResponse,
  type UserProfileResponse,
  type UserProfileUpdate,
  type WeightEntryResponse,
  type WeightStatsResponse,
  type PrsResponse,
} from "../api";
import { formatDuration } from "../format";
import MeasurementsSection from "./health/MeasurementsSection";
import SettingsModal from "./health/SettingsModal";
import SimpleChart from "./health/SimpleChart";
import WellnessSection from "./health/WellnessSection";
import { shortDate } from "./health/utils";

// ─── Helpers ───────────────────────────────────────────────

function bmiColor(cat: string | null): string {
  switch (cat) {
    case "Normal": return "text-green-400";
    case "Underweight": return "text-yellow-400";
    case "Overweight": return "text-orange-400";
    case "Obese": return "text-red-400";
    default: return "text-white/50";
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

// ─── Main Component ────────────────────────────────────────

export default function HealthTab() {
  // Data state
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [weights, setWeights] = useState<WeightEntryResponse[]>([]);
  const [stats, setStats] = useState<WeightStatsResponse | null>(null);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [goal, setGoal] = useState<GoalProgressResponse | null>(null);
  const [bmi, setBmi] = useState<BmiResponse | null>(null);
  const [score, setScore] = useState<HealthScoreResponse | null>(null);
  const [prs, setPrs] = useState<PrsResponse | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showWellness, setShowWellness] = useState(false);
  const [showMeas, setShowMeas] = useState(false);

  const loadAll = async () => {
    try {
      const [
        p, w, s, st, g, b, sc, pr,
      ] = await Promise.all([
        api.getProfile(),
        api.getWeightEntries(),
        api.getWeightStats(),
        api.getWeightStreak(),
        api.getGoalProgress(),
        api.getBmi(),
        api.getHealthScore(),
        api.getPrs(),
      ]);
      setProfile(p);
      setWeights(w);
      setStats(s);
      setStreak(st);
      setGoal(g);
      setBmi(b);
      setScore(sc);
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

  const updateProfile = async (data: UserProfileUpdate) => {
    await api.updateProfile(data);
    setShowSettings(false);
    loadAll();
  };

  if (loading) {
    return <div className="text-center py-8 text-fg/40">Loading health data...</div>;
  }

  return (
    <div className="health-tab space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-fg/50 font-medium">Your Health Overview</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="text-fg/30 hover:text-accent transition-colors"
          title="Health Settings"
        >
          <Gear size={20} />
        </button>
      </div>

      {/* Health Score Card */}
      {score && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ffffff10" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke={score.score >= 80 ? "#4cb782" : score.score >= 60 ? "#facc15" : "#f97316"}
                  strokeWidth="3" strokeDasharray="97.4"
                  strokeDashoffset={97.4 - (score.score / 100) * 97.4}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${score.score >= 80 ? "text-green-400" : score.score >= 60 ? "text-yellow-400" : "text-orange-400"}`}>
                  {score.score}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Health Score</p>
              <p className="text-xs text-fg/50 mt-0.5">{score.spotlight}</p>
            </div>
          </div>
          <div className="flex gap-3 text-[10px] text-fg/40 justify-between">
            <span>BMI: {score.bmi_score}/40</span>
            <span>Workouts: {score.workout_score}/30</span>
            <span>Streak: {score.streak_score}/15</span>
            <span>Meas: {score.measurement_score}/15</span>
          </div>
        </div>
      )}

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

      {/* Weekly Summary */}
      {stats && stats.total_entries > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <p className="text-xs text-fg/40 mb-2">This Week</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {stats.avg_7d ? stats.avg_7d.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-fg/40">kg avg</span>
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-fg/50">
            <span>Highest: {stats.max?.weight_kg.toFixed(1)} kg</span>
            <span>Lowest: {stats.min?.weight_kg.toFixed(1)} kg</span>
          </div>
          <p className="text-xs text-fg/40 mt-1.5">
            Logged {stats.total_entries} total entries
          </p>
        </div>
      )}

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
                <p className="text-sm font-semibold text-white">{streakMsg(streak.current_streak)}</p>
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
              {goal.remaining_kg > 0 ? (
                `${Math.abs(goal.remaining_kg).toFixed(1)} kg to go`
              ) : (
                <span className="inline-flex items-center gap-1">
                  Goal reached! <Confetti size={14} weight="fill" className="text-accent" />
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Personal Records */}
      {prs && (prs.by_exercise.length > 0 || prs.fastest_5k_seconds) && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={20} className="text-yellow-400 shrink-0" weight="fill" />
            <p className="text-sm font-semibold text-white">Personal Records</p>
          </div>

          {/* Exercise PRs */}
          {prs.by_exercise.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {prs.by_exercise.slice(0, 10).map((rec, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-white truncate">{rec.exercise_name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-semibold text-accent">
                      {rec.unit === "seconds" ? formatDuration(rec.value) : rec.value.toFixed(1) + " " + rec.unit}
                    </span>
                    {rec.date && <span className="text-[10px] text-fg/40 block">{shortDate(rec.date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Run PRs */}
          {(prs.fastest_5k_seconds || prs.fastest_10k_seconds) && (
            <div className="border-t border-fg/5 pt-2 mt-2">
              <p className="text-xs text-fg/40 mb-1.5">Run Records</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {prs.fastest_5k_seconds && (
                  <div className="bg-bg rounded-lg p-2">
                    <p className="text-fg/50">Fastest 5K</p>
                    <p className="text-sm font-bold text-white">{formatDuration(prs.fastest_5k_seconds)}</p>
                  </div>
                )}
                {prs.fastest_10k_seconds && (
                  <div className="bg-bg rounded-lg p-2">
                    <p className="text-fg/50">Fastest 10K</p>
                    <p className="text-sm font-bold text-white">{formatDuration(prs.fastest_10k_seconds)}</p>
                  </div>
                )}
                {prs.longest_run_distance_km && (
                  <div className="bg-bg rounded-lg p-2">
                    <p className="text-fg/50">Longest Run</p>
                    <p className="text-sm font-bold text-white">{prs.longest_run_distance_km.toFixed(1)} km</p>
                  </div>
                )}
                {prs.best_week_distance_km != null && prs.best_week_distance_km > 0 && (
                  <div className="bg-bg rounded-lg p-2">
                    <p className="text-fg/50">Best Week</p>
                    <p className="text-sm font-bold text-white">{(prs.best_week_distance_km).toFixed(1)} km</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weight History */}
      {weights.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-fg/5">
          <p className="text-xs text-fg/40 mb-2">Recent Weights</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {weights.slice(0, 20).map((w) => (
              <div key={w.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{w.weight_kg.toFixed(1)} kg</span>
                  <span className="text-xs text-fg/40">{shortDate(w.date)}</span>
                </div>
                <button
                  onClick={() => deleteWeight(w.id)}
                  className="text-xs text-red-400/50 hover:text-red-400"
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
            <span className="text-sm font-semibold text-white">Body Measurements</span>
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
            <span className="text-sm font-semibold text-white">Wellness Check-in</span>
            <p className="text-[11px] text-fg/40 mt-0.5">Log your mood, energy, stress, and sleep to spot trends</p>
          </div>
        </div>
        {showWellness ? <CaretUp size={18} /> : <CaretDown size={18} />}
      </button>
      {showWellness && <WellnessSection />}

      {/* Settings Modal */}
      {showSettings && profile && (
        <SettingsModal
          profile={profile}
          onSave={updateProfile}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
