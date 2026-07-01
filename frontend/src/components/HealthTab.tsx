import { useEffect, useState } from "react";
import {
  CaretDown,
  CaretUp,
  Gear,
  Smiley,
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
} from "../api";

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

  // UI state
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showWellness, setShowWellness] = useState(false);
  const [showMeas, setShowMeas] = useState(false);

  const loadAll = async () => {
    try {
      const [
        p, w, s, st, g, b, sc,
      ] = await Promise.all([
        api.getProfile(),
        api.getWeightEntries(),
        api.getWeightStats(),
        api.getWeightStreak(),
        api.getGoalProgress(),
        api.getBmi(),
        api.getHealthScore(),
      ]);
      setProfile(p);
      setWeights(w);
      setStats(s);
      setStreak(st);
      setGoal(g);
      setBmi(b);
      setScore(sc);
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
              {goal.remaining_kg > 0
                ? `${Math.abs(goal.remaining_kg).toFixed(1)} kg to go`
                : "Goal reached! 🎉"}
            </p>
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
              className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
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
              className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
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

  const emoji = (val: number) => {
    if (val <= 1) return "😔";
    if (val <= 2) return "😐";
    if (val <= 3) return "🙂";
    if (val <= 4) return "😊";
    return "🤩";
  };

  const latest = entries[0];

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
      {latest && (
        <div className="text-xs text-fg/50 mb-1">
          Last: Mood {emoji(latest.mood ?? 3)} {latest.mood}/5 ·
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
          <p className="text-xs text-fg/50 mb-1">Mood: {emoji(mood)}</p>
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
