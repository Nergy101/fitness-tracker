import { Power as HandFist, Trophy as Trophy } from "reicon-react";
import { type BoxingPrsResponse, type PrsResponse } from "../../api";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, type ActivityKind } from "../../activity";
import { formatDuration } from "../../format";

export function RecordGroup({
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

export function PersonalRecordsCard({ prs, boxingPrs }: { prs: PrsResponse; boxingPrs: BoxingPrsResponse | null }) {
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
        <Trophy size={20} className="text-yellow-400 shrink-0" weight="Filled" />
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
