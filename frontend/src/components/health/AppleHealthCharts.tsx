/**
 * Specialized Apple Health charts rendered inside the Stats tab's
 * "Apple Health" block, below the generic per-metric trend cards:
 *
 *   - Sleep: stage-stacked daily bars (deep/core/rem) with an 8 h goal line
 *   - Heart Rate Range: shaded daily min–max band around the average
 *   - Workout Intensity: imported-workout scatter (duration × avg HR)
 *   - Recovery vs Training Load: native session minutes vs resting HR
 *   - Sleep vs Mood: imported sleep vs wellness check-in mood
 *   - Active Energy vs Weight: imported energy vs logged weight
 *
 * The simple metric series arrive as props (already fetched by the Stats
 * tab); workouts, native daily activity, and wellness entries are fetched
 * here since nothing else on the tab needs them.
 */

import { useEffect, useState } from "react";
import {
  Dumbbell as Barbell,
  Fire as Fire,
  Moon as Moon,
  Run as PersonSimpleRun,
  Pulse as Pulse,
  FaceSmile as Smiley,
} from "reicon-react";
import {
  api,
  type DailyActivityPoint,
  type HealthPoint,
  type HealthSeries,
  type HealthWorkoutSummary,
  type WeightEntryResponse,
  type WellnessResponse,
} from "../../api";
import ChartCard from "../ChartCard";
import {
  ACCENT,
  BandChart,
  BarChart,
  DailyStackedBarChart,
  DualAxisChart,
  ScatterChart,
  type BandPt,
  type BPt,
  type DualPt,
  type SPt,
  type StkPt,
} from "./insightCharts";
import { shortDate } from "./utils";

// Sleep stage stacking order (bottom-up) and colors, Apple Health-like.
// `awake` is reported by the export but excluded: totalSleep = deep+core+rem,
// so stacking awake would inflate bars past the hours actually slept.
const SLEEP_STAGES: { key: "deep" | "core" | "rem"; color: string; label: string }[] = [
  { key: "deep", color: "#6d28d9", label: "Deep" },
  { key: "core", color: "#3b82f6", label: "Core" },
  { key: "rem", color: "#7dd3fc", label: "REM" },
];

// Fixed palette for workout-name coloring (stable by first-seen index).
const SPORT_PALETTE = [
  "#4cb782", // accent green
  "#38bdf8", // sky
  "#fb923c", // orange
  "#a78bfa", // violet
  "#f472b6", // pink
  "#34d399", // emerald
  "#facc15", // yellow — also used for "Other" (index 6)
];
const MAX_LEGEND = 6;

const SYNC_HINT = "More data needed for trend — keep syncing";

function threeXLabels(pts: { date: string }[]): [string, string, string] {
  const n = pts.length;
  return [shortDate(pts[0].date), shortDate(pts[Math.floor(n / 2)].date), shortDate(pts[n - 1].date)];
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {items.map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1 text-[10px] text-fg/40">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function AppleHealthCharts({
  series,
  weightEntries,
}: {
  series: HealthSeries[];
  weightEntries: WeightEntryResponse[];
}) {
  const [workouts, setWorkouts] = useState<HealthWorkoutSummary[]>([]);
  const [activity, setActivity] = useState<DailyActivityPoint[]>([]);
  const [wellness, setWellness] = useState<WellnessResponse[]>([]);

  useEffect(() => {
    Promise.all([
      api.getHealthWorkouts(120).catch(() => null),
      api.getDailyActivity(120).catch(() => null),
      api.getWellnessEntries().catch(() => [] as WellnessResponse[]),
    ]).then(([wo, act, well]) => {
      setWorkouts(wo?.workouts ?? []);
      setActivity(act?.days ?? []);
      setWellness(well);
    });
  }, []);

  const pts = (metric: string): HealthPoint[] =>
    series.find((s) => s.metric === metric)?.points ?? [];

  // ── Sleep: stage stack (or plain bars when the export has no stages) ──────
  const sleepRaw = pts("sleep_analysis");
  const hasStages = sleepRaw.some((p) => p.stages != null);
  const sleepStkPts: StkPt[] = sleepRaw.map((p, i) => ({
    x: i,
    segments: p.stages
      ? SLEEP_STAGES.flatMap(({ key, color }) => {
          const v = p.stages![key];
          return v != null && v > 0 ? [{ value: v, color }] : [];
        })
      : [{ value: p.value, color: ACCENT }],
  }));
  const sleepBPts: BPt[] = sleepRaw.map((p, i) => ({
    x: i,
    y: p.value,
    color: p.value < 6.5 ? "#f97316" : ACCENT,
  }));
  const sleepLatest = sleepRaw.length ? sleepRaw[sleepRaw.length - 1].value : null;
  const sleepAvg = sleepRaw.length
    ? sleepRaw.reduce((s, p) => s + p.value, 0) / sleepRaw.length
    : null;

  // ── Heart-rate range band ─────────────────────────────────────────────────
  const hrRaw = pts("heart_rate");
  const hrBanded = hrRaw.filter((p) => p.min != null && p.max != null);
  const hrBandPts: BandPt[] = hrBanded.map((p, i) => ({
    x: i, avg: p.value, min: p.min as number, max: p.max as number,
  }));
  const hrLatest = hrRaw.length ? hrRaw[hrRaw.length - 1].value : null;

  // ── Workout intensity scatter ─────────────────────────────────────────────
  const validWorkouts = workouts.filter((w) => w.duration_min != null && w.avg_hr != null);
  const workoutNames = [...new Set(validWorkouts.map((w) => w.name))].sort();
  const nameIdx = new Map(workoutNames.map((n, i) => [n, i]));
  const woSPts: SPt[] = validWorkouts.map((w) => {
    const idx = nameIdx.get(w.name) ?? MAX_LEGEND;
    const colorIdx = Math.min(idx, MAX_LEGEND, SPORT_PALETTE.length - 1);
    return { x: w.duration_min!, y: w.avg_hr!, color: SPORT_PALETTE[colorIdx] };
  });
  const woLegend = workoutNames
    .slice(0, MAX_LEGEND)
    .map((name, i) => ({ label: name, color: SPORT_PALETTE[i] }));
  if (workoutNames.length > MAX_LEGEND) {
    woLegend.push({ label: "Other", color: SPORT_PALETTE[SPORT_PALETTE.length - 1] });
  }

  // ── Recovery vs training load ─────────────────────────────────────────────
  const rstRaw = pts("resting_heart_rate");
  const actMap = new Map(activity.map((d) => [d.date, d.minutes]));
  const rstMap = new Map(rstRaw.map((p) => [p.date, p.value]));
  const recoveryDates = [...new Set([...actMap.keys(), ...rstMap.keys()])].sort().slice(-60);
  const recoveryPts: DualPt[] = recoveryDates.map((date, i) => ({
    x: i,
    bar: actMap.get(date) ?? 0,
    line: rstMap.get(date) ?? null,
  }));
  const showRecovery =
    recoveryPts.length >= 2 &&
    recoveryPts.some((p) => p.line != null) &&
    recoveryPts.some((p) => p.bar > 0);

  // ── Sleep vs wellness mood ────────────────────────────────────────────────
  const wellnessMood = wellness.filter((w) => w.mood != null);
  const moodMap = new Map(wellnessMood.map((w) => [w.date, w.mood as number]));
  const sleepMoodPts: DualPt[] = sleepRaw.map((p, i) => ({
    x: i,
    bar: p.value,
    line: moodMap.get(p.date) ?? null,
  }));
  const showSleepMood =
    wellnessMood.length >= 3 && sleepRaw.length >= 2 && sleepMoodPts.some((p) => p.line != null);

  // ── Active energy vs weight ───────────────────────────────────────────────
  const energyRaw = pts("active_energy");
  const wtMap = new Map(weightEntries.map((w) => [w.date, w.weight_kg]));
  const wtEnergyPts: DualPt[] = energyRaw.map((p, i) => ({
    x: i,
    bar: p.value,
    line: wtMap.get(p.date) ?? null,
  }));
  const showWtEnergy =
    weightEntries.length >= 2 && energyRaw.length >= 2 && wtEnergyPts.some((p) => p.line != null);

  return (
    <>
      {/* Sleep — stage-stacked bars */}
      {sleepRaw.length >= 1 && (
        <ChartCard
          icon={<Moon size={16} style={{ color: "#818cf8" }} />}
          title="Sleep"
          sub={`${sleepLatest!.toFixed(1)} h · avg ${sleepAvg!.toFixed(1)} h · goal 8 h`}
        >
          {sleepRaw.length >= 2 ? (
            <>
              {hasStages ? (
                <DailyStackedBarChart
                  points={sleepStkPts}
                  goalValue={8}
                  goalLabel="8 h"
                  xLabels={threeXLabels(sleepRaw)}
                  formatY={(v) => `${v.toFixed(1)} h`}
                />
              ) : (
                <BarChart
                  points={sleepBPts}
                  goalValue={8}
                  goalLabel="8 h"
                  xLabels={threeXLabels(sleepRaw)}
                  formatY={(v) => `${v.toFixed(1)} h`}
                />
              )}
              {hasStages && <Legend items={SLEEP_STAGES.map(({ color, label }) => ({ color, label }))} />}
            </>
          ) : (
            <p className="text-[10px] text-fg/30 text-center py-2">{SYNC_HINT}</p>
          )}
        </ChartCard>
      )}

      {/* Heart Rate Range — min–max band + avg line */}
      {hrRaw.length >= 1 && (
        <ChartCard
          icon={<Pulse size={16} style={{ color: "#f472b6" }} />}
          title="Heart Rate Range"
          sub={`avg ${Math.round(hrLatest!)} bpm`}
        >
          {hrBandPts.length >= 2 ? (
            <BandChart points={hrBandPts} color="#f472b6" xLabels={threeXLabels(hrBanded)} />
          ) : (
            <p className="text-[10px] text-fg/30 text-center py-2">{SYNC_HINT}</p>
          )}
        </ChartCard>
      )}

      {/* Workout Intensity — duration × avg HR scatter */}
      {woSPts.length >= 3 && (
        <ChartCard
          icon={<Barbell size={16} style={{ color: ACCENT }} />}
          title="Workout Intensity"
          sub="duration vs avg HR"
        >
          <ScatterChart points={woSPts} xLabel="Duration (min)" />
          <Legend items={woLegend} />
        </ChartCard>
      )}

      {/* Recovery vs Training Load */}
      {showRecovery && (
        <ChartCard
          icon={<PersonSimpleRun size={16} style={{ color: "#38bdf8" }} />}
          title="Recovery vs Training Load"
          sub="60 d"
        >
          <DualAxisChart
            points={recoveryPts}
            barColor="#38bdf8"
            lineColor="#fb923c"
            barLabel="Activity min"
            lineLabel="Resting HR"
            xLabels={threeXLabels(recoveryDates.map((date) => ({ date })))}
          />
        </ChartCard>
      )}

      {/* Sleep vs Mood */}
      {showSleepMood && (
        <ChartCard icon={<Smiley size={16} style={{ color: "#a78bfa" }} />} title="Sleep vs Mood">
          <DualAxisChart
            points={sleepMoodPts}
            barColor={ACCENT}
            lineColor="#a78bfa"
            barLabel="Sleep (h)"
            lineLabel="Mood (1–5)"
            xLabels={threeXLabels(sleepRaw)}
          />
        </ChartCard>
      )}

      {/* Active Energy vs Weight */}
      {showWtEnergy && (
        <ChartCard icon={<Fire size={16} style={{ color: "#f59e0b" }} />} title="Active Energy vs Weight">
          <DualAxisChart
            points={wtEnergyPts}
            barColor="#f59e0b"
            lineColor="#c084fc"
            barLabel="Energy (kcal)"
            lineLabel="Weight (kg)"
            xLabels={threeXLabels(energyRaw)}
          />
        </ChartCard>
      )}
    </>
  );
}
