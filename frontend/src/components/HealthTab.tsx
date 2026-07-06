import { useEffect, useState } from "react";
import {
  CaretDown,
  CaretUp,
  Check,
  Confetti,
  Gear,
  Smiley,
  SmileyMeh,
  SmileySad,
  SmileySticker,
  SmileyWink,
  Ruler,
  Flame,
  Trophy,
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
  type BodyMeasurementResponse,
  type MeasurementChangesResponse,
  type WellnessResponse,
  type WellnessTrendsResponse,
  type PrsResponse,
} from "../api";
import { formatDuration } from "../format";
import {
  requestNotificationPermission,
  registerPushSubscription,
  unsubscribePush,
  getNotificationStatus,
} from "../notifications";

// ─── Helpers ───────────────────────────────────────────────

function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

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

// ─── Simple SVG Weight Chart ────────────────────────────────

function SimpleChart({ entries }: { entries: WeightEntryResponse[] }) {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-30);
  if (recent.length < 2) return null;

  const values = recent.map((e) => e.weight_kg);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min;
  const w = 300;
  const h = 100;
  const labels = [recent[0], recent[Math.floor(recent.length / 2)], recent[recent.length - 1]];

  const points = recent.map((e, i) => {
    const x = (i / (recent.length - 1)) * w;
    const y = h - ((e.weight_kg - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      <p className="text-xs text-fg/40 mb-3">Weight Trend (30d)</p>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-28">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="#4cb782"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {recent.map((e, i) => {
          const x = (i / (recent.length - 1)) * w;
          const y = h - ((e.weight_kg - min) / range) * h;
          return <circle key={e.id} cx={x} cy={y} r="2.5" fill="#4cb782" />;
        })}
        {labels.map((e, i) => {
          const idx = recent.indexOf(e);
          if (idx < 0) return null;
          const x = (idx / (recent.length - 1)) * w;
          return (
            <text key={i} x={x} y={h + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
              {shortDate(e.date)}
            </text>
          );
        })}
        <text x="0" y="10" className="fill-fg/30" fontSize="9">{max.toFixed(1)}</text>
        <text x="0" y={h - 4} className="fill-fg/30" fontSize="9">{min.toFixed(1)}</text>
      </svg>
    </div>
  );
}

// ─── Settings Modal ────────────────────────────────────────

function SettingsModal({
  profile,
  onSave,
  onClose,
}: {
  profile: UserProfileResponse;
  onSave: (data: UserProfileUpdate) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    height_cm: profile.height_cm ?? undefined,
    birthday: profile.birthday ?? "",
    gender: profile.gender ?? "",
    goal_weight_kg: profile.goal_weight_kg ?? undefined,
    weight_unit: profile.weight_unit,
    reminder_time: profile.reminder_time ?? "",
    notifications_enabled: profile.notifications_enabled,
  });

  // ─── Push Notification State ──────────────────────
  const [pushStatus, setPushStatus] = useState<ReturnType<typeof getNotificationStatus>>(
    getNotificationStatus(),
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setPushStatus(getNotificationStatus());
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setPushStatus(perm as "granted" | "denied" | "prompt" | "unsupported");
      if (perm === "granted") {
        const sub = await registerPushSubscription();
        if (sub) setPushSubscribed(true);
      }
    } catch (e) {
      console.error("Push notification setup failed", e);
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await unsubscribePush();
      setPushSubscribed(false);
      setPushStatus("prompt"); // reset to prompt so user can re-enable
    } catch (e) {
      console.error("Push unsubscribe failed", e);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await api.sendTestNotification();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (e) {
      console.error("Test notification failed", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-fg/10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Health Settings</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-white text-xl">&times;</button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs text-fg/50 block mb-1">Height (cm)</label>
            <input type="number" step="0.1" value={form.height_cm ?? ""}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
          </div>
          <div>
            <label className="text-xs text-fg/50 block mb-1">Birthday</label>
            <input type="date" value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className="w-full min-w-0 bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50 box-border" />
          </div>
          <div>
            <label className="text-xs text-fg/50 block mb-1">Gender</label>
            <select value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-fg/50 block mb-1">Goal Weight (kg)</label>
            <input type="number" step="0.1" value={form.goal_weight_kg ?? ""}
              onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
          </div>
          <div>
            <label className="text-xs text-fg/50 block mb-1">Reminder Time</label>
            <input type="time" value={form.reminder_time}
              onChange={(e) => setForm({ ...form, reminder_time: e.target.value })}
              className="w-full min-w-0 bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50 box-border" />
          </div>

          {/* ─── Push Notifications ─────────────────── */}
          <div className="bg-bg/50 rounded-xl p-3 border border-fg/5">
            <p className="text-xs text-fg/40 mb-2.5">Push Notifications</p>
            {pushStatus === "unsupported" ? (
              <p className="text-xs text-fg/40">Not supported in this browser.</p>
            ) : pushStatus === "denied" ? (
              <p className="text-xs text-orange-400">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            ) : pushSubscribed ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400">Push notifications active</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleTestNotification}
                    disabled={pushLoading}
                    className="flex-1 bg-accent/20 text-accent rounded-lg py-1.5 text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50"
                  >
                    {testSent ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <Check size={12} weight="bold" /> Sent!
                      </span>
                    ) : (
                      "Send Test"
                    )}
                  </button>
                  <button
                    onClick={handleDisablePush}
                    disabled={pushLoading}
                    className="bg-red-400/10 text-red-400 rounded-lg py-1.5 px-3 text-xs font-medium hover:bg-red-400/20 transition-colors disabled:opacity-50"
                  >
                    Disable
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {pushLoading ? "Setting up..." : "Enable Push Notifications"}
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.notifications_enabled}
              onChange={(e) => setForm({ ...form, notifications_enabled: e.target.checked })}
              className="accent-accent" />
            <span className="text-fg/80">Enable daily reminders</span>
          </label>

          <button onClick={() => onSave(form)}
            className="w-full bg-accent text-bg rounded-xl py-2.5 font-semibold hover:bg-accent/90 transition-colors mt-2">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Measurements Section ──────────────────────────────────

function MeasurementsSection() {
  const [measurements, setMeasurements] = useState<BodyMeasurementResponse[]>([]);
  const [changes, setChanges] = useState<MeasurementChangesResponse | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMeas, setSelectedMeas] = useState<Set<string>>(new Set(["waist_cm"]));
  const [measRange, setMeasRange] = useState<"30d" | "90d" | "all">("90d");

  useEffect(() => {
    api.getMeasurements().then(setMeasurements).catch(() => {});
    api.getMeasurementChanges().then(setChanges).catch(() => {});
    setLoading(false);
  }, []);

  const fields = [
    { key: "waist_cm", label: "Waist" },
    { key: "hips_cm", label: "Hips" },
    { key: "chest_cm", label: "Chest" },
    { key: "left_arm_cm", label: "Left Arm" },
    { key: "right_arm_cm", label: "Right Arm" },
    { key: "left_thigh_cm", label: "Left Thigh" },
    { key: "right_thigh_cm", label: "Right Thigh" },
    { key: "neck_cm", label: "Neck" },
  ];

  const submit = async () => {
    const data: Record<string, number | null> = {};
    fields.forEach((f) => {
      data[f.key] = form[f.key] ? parseFloat(form[f.key]) : null;
    });
    await api.createMeasurement(data as any);
    setShowForm(false);
    setForm({});
    api.getMeasurements().then(setMeasurements);
    api.getMeasurementChanges().then(setChanges);
  };

  if (loading) return null;

  const latest = measurements[0];

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
      {latest && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {fields.map((f) => {
            const val = (latest as any)[f.key];
            const delta = changes?.deltas[f.key];
            return (
              <div key={f.key} className="flex justify-between items-center py-0.5">
                <span className="text-fg/50">{f.label}</span>
                <span className="text-white font-medium">
                  {val != null ? `${val} cm` : "—"}
                  {delta != null && (
                    <span className={delta >= 0 ? "text-orange-400 ml-1" : "text-green-400 ml-1"}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Measurement Trend Chart */}
      {measurements.length >= 2 && (
        <MeasurementTrendChart
          measurements={measurements}
          selected={selectedMeas}
          range={measRange}
        />
      )}

      {/* Measurement toggle buttons */}
      {measurements.length >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-fg/40">Show on chart</span>
            <div className="flex gap-1">
              {(["30d", "90d", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setMeasRange(r)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    measRange === r
                      ? "bg-accent/20 text-accent"
                      : "text-fg/30 hover:text-fg/60"
                  }`}
                >
                  {r === "all" ? "All" : r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => {
              const active = selectedMeas.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    const next = new Set(selectedMeas);
                    if (active && next.size > 1) next.delete(f.key);
                    else if (!active) next.add(f.key);
                    setSelectedMeas(next);
                  }}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-accent/15 border-accent/30 text-accent"
                      : "border-fg/10 text-fg/40 hover:text-fg/70"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-bg rounded-lg py-2 text-sm text-accent font-medium hover:bg-bg/80 transition-colors">
          + Add Measurements
        </button>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <input key={f.key} type="number" step="0.1" placeholder={`${f.label} (cm)`} value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="bg-bg border border-fg/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent/50" />
            ))}
          </div>
          <button onClick={submit}
            className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold">
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Measurement Trend Chart ──────────────────────────────

const MEAS_COLORS = [
  "#4cb782", "#facc15", "#f97316", "#a78bfa",
  "#f472b6", "#38bdf8", "#fb923c", "#34d399",
];

function MeasurementTrendChart({
  measurements,
  selected,
  range,
}: {
  measurements: BodyMeasurementResponse[];
  selected: Set<string>;
  range: "30d" | "90d" | "all";
}) {
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const cutoff = range === "all" ? 0 : range === "90d" ? 90 : 30;
  const filtered = cutoff > 0
    ? sorted.filter(
        (m) =>
          new Date(m.date).getTime() >= Date.now() - cutoff * 86400000,
      )
    : sorted;
  if (filtered.length < 2) return null;

  const selectedFields = [...selected];
  const w = 300;
  const h = 100;

  // Collect all non-null values for the selected fields
  const allValues: number[] = [];
  const series: { key: string; points: { x: number; y: number }[]; color: string }[] = [];
  selectedFields.forEach((field, fi) => {
    const pts: { x: number; y: number }[] = [];
    filtered.forEach((m, i) => {
      const val = (m as any)[field];
      if (val != null) {
        const x = (i / (filtered.length - 1)) * w;
        pts.push({ x, y: val });
        allValues.push(val);
      }
    });
    if (pts.length >= 2) {
      series.push({ key: field, points: pts, color: MEAS_COLORS[fi % MEAS_COLORS.length] });
    }
  });

  if (series.length === 0) return null;

  const min = Math.min(...allValues) - 1;
  const max = Math.max(...allValues) + 1;
  const range_val = max - min || 1;

  const labels = [filtered[0], filtered[Math.floor(filtered.length / 2)], filtered[filtered.length - 1]];

  return (
    <div>
      <p className="text-[10px] text-fg/40 mb-2">Trends</p>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-28">
        {series.map((s) => (
          <polyline
            key={s.key}
            points={s.points.map((p) => `${p.x},${h - ((p.y - min) / range_val) * h}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {series.map((s) =>
          s.points.map((p, i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={p.x}
              cy={h - ((p.y - min) / range_val) * h}
              r="2"
              fill={s.color}
            />
          )),
        )}
        {labels.map((e, i) => {
          const idx = filtered.indexOf(e);
          if (idx < 0) return null;
          const x = (idx / (filtered.length - 1)) * w;
          return (
            <text key={i} x={x} y={h + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
              {shortDate(e.date)}
            </text>
          );
        })}
        <text x="0" y="10" className="fill-fg/30" fontSize="9">{max.toFixed(1)}</text>
        <text x="0" y={h - 4} className="fill-fg/30" fontSize="9">{min.toFixed(1)}</text>
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1">
        {series.map((s) => {
          const measFields = [
            { key: "waist_cm", label: "Waist" },
            { key: "hips_cm", label: "Hips" },
            { key: "chest_cm", label: "Chest" },
            { key: "left_arm_cm", label: "Left Arm" },
            { key: "right_arm_cm", label: "Right Arm" },
            { key: "left_thigh_cm", label: "Left Thigh" },
            { key: "right_thigh_cm", label: "Right Thigh" },
            { key: "neck_cm", label: "Neck" },
          ];
          const label = measFields.find((f) => f.key === s.key)?.label ?? s.key;
          return (
            <span key={s.key} className="flex items-center gap-1 text-[10px] text-fg/50">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Wellness Section ──────────────────────────────────────

function WellnessSection() {
  const [entries, setEntries] = useState<WellnessResponse[]>([]);
  const [trends, setTrends] = useState<WellnessTrendsResponse | null>(null);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(7);

  useEffect(() => {
    api.getWellnessEntries().then(setEntries).catch(() => {});
    api.getWellnessTrends().then(setTrends).catch(() => {});
  }, []);

  const submit = async () => {
    await api.createWellnessEntry({ mood, energy, stress, sleep_hours: sleep });
    api.getWellnessEntries().then(setEntries);
    api.getWellnessTrends().then(setTrends);
  };

  const moodIcon = (val: number) => {
    const MoodFace =
      val <= 1 ? SmileySad
      : val <= 2 ? SmileyMeh
      : val <= 3 ? Smiley
      : val <= 4 ? SmileyWink
      : SmileySticker;
    return <MoodFace size={14} weight="fill" className="inline align-[-2px] text-accent" />;
  };

  const latest = entries[0];

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
      {latest && (
        <div className="text-xs text-fg/50 mb-1">
          Last: Mood {moodIcon(latest.mood ?? 3)} {latest.mood}/5 ·
          Energy {latest.energy}/5 ·
          Stress {latest.stress}/5 ·
          Sleep {latest.sleep_hours?.toFixed(1)}h
          <span className="text-fg/30 ml-1">({shortDate(latest.date)})</span>
        </div>
      )}

      {trends && trends.weekly_averages.length > 0 && (
        <div className="flex gap-3 text-[10px] text-fg/40">
          {trends.weekly_averages.slice(0, 4).reverse().map((w) => (
            <div key={w.week_start} className="flex-1 text-center bg-bg rounded-lg py-1.5">
              <p className="font-medium text-white">{w.avg_mood ?? "—"}</p>
              <p>Mood</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div>
          <p className="text-xs text-fg/50 mb-1">Mood: {moodIcon(mood)}</p>
          <input type="range" min="1" max="5" value={mood} onChange={(e) => setMood(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Energy: {energy}/5</p>
          <input type="range" min="1" max="5" value={energy} onChange={(e) => setEnergy(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Stress: {stress}/5</p>
          <input type="range" min="1" max="5" value={stress} onChange={(e) => setStress(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Sleep: {sleep}h</p>
          <input type="range" min="3" max="12" step="0.5" value={sleep} onChange={(e) => setSleep(parseFloat(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <button onClick={submit}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold mt-1">
          Log Check-in
        </button>
      </div>
    </div>
  );
}
