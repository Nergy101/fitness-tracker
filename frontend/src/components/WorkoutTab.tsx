import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon as CheckCircle, PlusIcon as Plus, SmileySadIcon as SmileySad } from "@phosphor-icons/react";
import Toast from "./Toast";
import { api, OfflineError, type BoxingEntryResponse, type CyclingEntryResponse, type Exercise, type RunEntryResponse, type WorkoutSession, type WorkoutTemplate } from "../api";
import { ACTIVITY_ICONS, type ActivityKind } from "../activity";
import { dayKey, todayKey } from "../dateKey";
import { formatDuration } from "../format";
import { computeDailyActivity } from "../dailyActivity";
import WorkoutEditor from "./WorkoutEditor";
import RunLogger from "./RunLogger";
import CyclingLogger from "./CyclingLogger";
import BoxingLogger from "./BoxingLogger";
import RecentWorkouts, { type EditRequest } from "./RecentWorkouts";
import WorkoutCard from "./WorkoutCard";
import WorkoutSkeleton from "./skeletons/WorkoutSkeleton";
import { useFocusTrap } from "../useFocusTrap";

interface WorkoutTabProps {
  onStartWorkout: (workout: WorkoutTemplate) => void;
  onLogWorkout?: () => void;
}
type RequestKind = "run" | "walk" | "cycling" | "boxing";
type ActivityRequest = { kind: RequestKind; key: number; runType?: "run" | "walk"; durationSeconds?: number; distanceKm?: number; rounds?: number };
type QuickEntry =
  | { kind: "run"; entry: RunEntryResponse }
  | { kind: "walk"; entry: RunEntryResponse }
  | { kind: "cycling"; entry: CyclingEntryResponse }
  | { kind: "boxing"; entry: BoxingEntryResponse };
const DEFAULT_KCAL_PER_MIN = 5;
const activityTint: Record<ActivityKind, string> = {
  workout: "bg-tint-workout-bg text-tint-workout-fg", run: "bg-tint-run-bg text-tint-run-fg", walk: "bg-tint-walk-bg text-tint-walk-fg", boxing: "bg-tint-boxing-bg text-tint-boxing-fg", cycling: "bg-tint-cycling-bg text-tint-cycling-fg",
};
function kcalFor(durationSeconds: number, kcalPerMin: number): number { return durationSeconds / 60 * kcalPerMin; }
function dateHeading(date: Date): string { return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(date); }

export default function WorkoutTab({ onStartWorkout, onLogWorkout }: WorkoutTabProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [consistencyPct, setConsistencyPct] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editRun, setEditRun] = useState<RunEntryResponse | null>(null);
  const [editWalk, setEditWalk] = useState<RunEntryResponse | null>(null);
  const [editCycling, setEditCycling] = useState<CyclingEntryResponse | null>(null);
  const [editBoxing, setEditBoxing] = useState<BoxingEntryResponse | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [activityRequest, setActivityRequest] = useState<ActivityRequest | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [lastSevenDays, setLastSevenDays] = useState<{ key: string; label: string; minutes: number }[]>([]);
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(deleteModalRef, () => setPendingDelete(null));

  async function refreshActivity(): Promise<void> {
    const [sessionList, runs, cycling, boxing] = await Promise.all([
      api.getSessions({ limit: 50 }).catch(() => [] as WorkoutSession[]),
      api.getRuns().catch(() => [] as RunEntryResponse[]),
      api.getCycling().catch(() => [] as CyclingEntryResponse[]),
      api.getBoxing().catch(() => [] as BoxingEntryResponse[]),
    ]);
    setSessions(sessionList);
    const entries: QuickEntry[] = [
      ...runs.map((entry) => entry.run_type === "walk" ? { kind: "walk" as const, entry } : { kind: "run" as const, entry }),
      ...cycling.map((entry) => ({ kind: "cycling" as const, entry })),
      ...boxing.map((entry) => ({ kind: "boxing" as const, entry })),
    ];
    entries.sort((a, b) => (b.entry.created_at ?? b.entry.date).localeCompare(a.entry.created_at ?? a.entry.date));
    setQuickEntries(entries.slice(0, 4));
    setLastSevenDays(computeDailyActivity(sessionList, runs, cycling).map((day) => ({ key: day.date, label: day.label, minutes: day.workout_minutes + day.run_minutes + day.walk_minutes + day.boxing_minutes + day.cycling_minutes })));
  }

  useEffect(() => {
    Promise.all([api.getWorkouts(), api.getExercises(), api.getStatsOverview().catch(() => null), api.getPrs().catch(() => null)])
      .then(async ([workouts, exercises, overview, prs]) => {
        setTemplates(workouts);
        setAllExercises(exercises);
        if (overview) setConsistencyPct(overview.consistency_score_pct);
        if (prs) setStreakDays(prs.streak_days_30d);
        await refreshActivity();
      })
      .catch(() => setError("Failed to load workouts"))
      .finally(() => setLoading(false));
  }, []);

  function openEditor(template: WorkoutTemplate | null) { setEditing(template); setShowEditor(true); }
  function handleActivityChanged() { setActivityRefreshKey((key) => key + 1); onLogWorkout?.(); void refreshActivity(); }
  function openActivity(kind: RequestKind, details: Omit<ActivityRequest, "kind" | "key"> = {}) {
    setActivityRequest((previous) => ({ ...details, kind, key: (previous?.key ?? 0) + 1 }));
  }
  function handleEditRequest(request: EditRequest) {
    switch (request.kind) {
      case "run": setEditRun(request.entry); break;
      case "walk": setEditWalk(request.entry); break;
      case "cycling": setEditCycling(request.entry); break;
      case "boxing": setEditBoxing(request.entry); break;
    }
  }
  function editQuickEntry(item: QuickEntry) {
    switch (item.kind) {
      case "run": setEditRun(item.entry); break;
      case "walk": setEditWalk(item.entry); break;
      case "cycling": setEditCycling(item.entry); break;
      case "boxing": setEditBoxing(item.entry); break;
    }
  }

  async function onSave() {
    const wasEditing = Boolean(editing);
    setShowEditor(false);
    setLoading(true);
    try { setTemplates(await api.getWorkouts()); setToast(wasEditing ? "Workout updated" : "Workout created"); }
    finally { setLoading(false); }
  }

  async function togglePin(template: WorkoutTemplate) {
    try {
      const updated = await api.togglePin(template.id, !template.is_pinned);
      setTemplates((previous) => previous.map((item) => item.id === updated.id ? updated : item));
      setToast(updated.is_pinned ? "Workout pinned" : "Workout unpinned");
    } catch (err) { setToast(err instanceof OfflineError ? "Pin update queued for sync" : "Failed to update pin"); }
  }

  const sortedTemplates = [...templates].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (a.is_pinned && b.is_pinned) { const orderA = a.pinned_order ?? 0; const orderB = b.pinned_order ?? 0; if (orderA !== orderB) return orderA - orderB; }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function logWorkout(template: WorkoutTemplate) {
    const rounds = Math.max(1, template.rounds || 1);
    const isTabata = template.mode === "tabata";
    const workDuration = isTabata ? rounds * 20 : template.exercises.reduce((sum, item) => sum + (item.duration_seconds || 30), 0) * rounds;
    const restDuration = isTabata ? Math.max(0, rounds - 1) * 10 : Math.max(0, rounds - 1) * (template.rest_between_rounds || 0);
    const warmupDuration = isTabata ? 0 : (template.warmup_seconds || 0);
    const cooldownDuration = isTabata ? 0 : (template.cooldown_seconds || 0);
    const totalDuration = template.mode === "amrap" ? (template.time_cap_seconds || 1200) : template.mode === "emom" ? template.exercises.length * 60 : workDuration + restDuration + warmupDuration + cooldownDuration;
    const totalKcal = isTabata
      ? Array.from({ length: rounds }, (_, index) => kcalFor(20, template.exercises[index % Math.max(1, template.exercises.length)]?.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN)).reduce((a, b) => a + b, 0)
      : template.exercises.reduce((sum, item) => sum + kcalFor(item.duration_seconds || 30, item.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN), 0) * rounds;
    try {
      await api.createSession({
        template_id: template.id, template_name: template.name || "", total_duration_seconds: totalDuration, total_kcal_estimated: totalKcal,
        exercises: template.exercises.map((item, index) => ({
          exercise_id: item.exercise?.id ?? item.exercise_id, exercise_name: item.exercise?.name || "",
          duration_seconds: isTabata ? 20 : (item.duration_seconds || 30),
          kcal_burned: kcalFor(isTabata ? 20 : (item.duration_seconds || 30), item.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN),
          order_index: index, completed: true,
        })),
      });
      setToast("Workout logged!"); handleActivityChanged();
    } catch (err) { setToast(err instanceof OfflineError ? "Workout queued for sync" : "Failed to log workout"); }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    try { await api.deleteWorkout(id); setTemplates((previous) => previous.filter((template) => template.id !== id)); setToast(`Deleted ${name}`); }
    catch (err) { setToast(err instanceof OfflineError ? "Deletion queued for sync" : "Failed to delete workout"); }
  }
  async function cloneWorkout(template: WorkoutTemplate) {
    try { const clone = await api.duplicateWorkout(template.id); setTemplates((previous) => [clone, ...previous]); setHighlightId(clone.id); setToast(`Duplicated as "${clone.name}"`); setTimeout(() => setHighlightId(null), 2000); }
    catch (err) { setToast(err instanceof OfflineError ? "Duplication queued for sync" : "Failed to duplicate workout"); }
  }

  const weekTotalMinutes = Math.round(lastSevenDays.reduce((sum, day) => sum + day.minutes, 0));
  const todaySessions = sessions.filter((session) => dayKey(new Date(session.started_at)) === todayKey());
  const maxDailyMinutes = Math.max(1, ...lastSevenDays.map((day) => day.minutes));
  const runRequest = activityRequest?.kind === "run" ? { ...activityRequest, runType: "run" as const } : null;
  const walkRequest = activityRequest?.kind === "walk" ? { ...activityRequest, runType: "walk" as const } : null;
  const cyclingRequest = activityRequest?.kind === "cycling" ? activityRequest : null;
  const boxingRequest = activityRequest?.kind === "boxing" ? activityRequest : null;

  return (
    <div className="workout-tab space-y-3">
      {toast && <Toast onDismiss={() => setToast(null)}><CheckCircle size={18} weight="fill" />{toast}</Toast>}
      <div className="flex items-center justify-between px-1 pb-1"><div><p className="text-sm text-muted">{dateHeading(new Date())}</p><h2 className="text-[26px] leading-tight font-extrabold tracking-tight">What did you do?</h2></div><button onClick={() => openEditor(null)} aria-label="Create a workout" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg"><Plus size={21} weight="bold" /></button></div>
      <section aria-label="Log an activity" className="grid grid-cols-3 gap-2.5">
        <div className={`col-span-2 min-h-36 rounded-[26px] p-3.5 ${activityTint.run}`}><div className="flex items-start justify-between"><div><div className="flex items-center gap-1.5"><ACTIVITY_ICONS.run size={20}/><span className="text-xl font-extrabold">Run</span></div><p className="mt-0.5 text-xs opacity-75">{quickEntries.find((entry)=>entry.kind==="run")?`Last: ${quickEntries.find((entry)=>entry.kind==="run")!.entry.distance_km.toFixed(1)} km`:"Log your next run"}</p></div><button onClick={()=>openActivity("run",{runType:"run"})} aria-label="Log a custom run" className="rounded-full bg-tint-run-chip p-2.5"><Plus size={20}/></button></div><div className="mt-4 grid grid-cols-3 gap-1.5">{[3,5,10].map((km)=><button key={km} onClick={()=>openActivity("run",{runType:"run",distanceKm:km})} className="h-10 rounded-2xl bg-tint-run-chip text-sm font-extrabold">{km} km</button>)}</div></div>
        <div className={`flex min-h-36 flex-col justify-between rounded-[26px] p-3 ${activityTint.walk}`}><div><ACTIVITY_ICONS.walk size={20}/><div className="text-xl font-extrabold">Walk</div><p className="text-xs opacity-75">Easy miles</p></div><button onClick={()=>openActivity("walk",{runType:"walk",durationSeconds:1800})} className="h-10 rounded-2xl bg-tint-walk-chip text-xs font-extrabold">+ 30 min</button></div>
        <div className={`flex h-32 flex-col justify-between rounded-[26px] p-3 ${activityTint.cycling}`}><div><ACTIVITY_ICONS.cycling size={20}/><div className="text-lg font-extrabold">Ride</div></div><button onClick={()=>openActivity("cycling",{durationSeconds:2700})} className="h-10 rounded-2xl bg-tint-cycling-chip text-xs font-extrabold">+ 45 min</button></div>
        <div className={`flex h-32 flex-col justify-between rounded-[26px] p-3 ${activityTint.boxing}`}><div><ACTIVITY_ICONS.boxing size={20}/><div className="text-lg font-extrabold">Box</div></div><button onClick={()=>openActivity("boxing",{durationSeconds:1800,rounds:6})} className="h-10 rounded-2xl bg-tint-boxing-chip text-xs font-extrabold">+ 6 rounds</button></div>
        <div className={`flex h-32 flex-col justify-between rounded-[26px] p-3 ${activityTint.workout}`}><div><ACTIVITY_ICONS.workout size={20}/><div className="text-lg font-extrabold">Workout</div></div><button onClick={()=>document.getElementById("today-templates")?.scrollIntoView({behavior:"smooth",block:"start"})} className="h-10 rounded-2xl bg-tint-workout-chip text-xs font-extrabold">Templates</button></div>
      </section>
      <section className="grid grid-cols-3 gap-2.5" aria-label="Activity overview"><div className="flex h-24 flex-col justify-between rounded-[24px] bg-surface p-3.5"><span className="text-xs font-semibold text-muted">Streak</span><div className="flex items-baseline gap-1"><span className="text-3xl font-extrabold tracking-tight">{streakDays}</span><span className="text-xs font-semibold">days</span></div></div><div className="col-span-2 rounded-[24px] bg-tint-blue-bg p-3.5 text-tint-blue-fg"><div className="flex items-center justify-between"><span className="text-xs font-semibold">Consistency</span><span className="text-2xl font-extrabold">{consistencyPct}%</span></div><div className="mt-2 h-2 rounded-full bg-surface"><div className="h-full rounded-full bg-tint-blue-bar" style={{width:`${Math.min(100,consistencyPct)}%`}}/></div></div><div className="col-span-3 flex h-24 flex-col justify-between rounded-[24px] bg-surface p-3.5"><div className="flex items-baseline justify-between"><span className="text-xs font-semibold text-muted">This week</span><span className="text-sm font-extrabold">{weekTotalMinutes} min</span></div><div className="flex h-10 items-end gap-1.5" aria-label="Minutes trained each day this week">{lastSevenDays.map((day)=><div key={day.key} className="flex h-full flex-1 flex-col justify-end gap-1"><span className="text-center text-[9px] text-muted">{day.label.slice(0,1)}</span><div title={`${day.label}: ${day.minutes} minutes`} className={`min-h-1 rounded-md ${day.minutes?"bg-accent":"bg-track"}`} style={{height:`${Math.max(12,Math.round(day.minutes/maxDailyMinutes*100))}%`}}/></div>)}</div></div></section>
      {!loading&&quickEntries.length>0&&<section className="rounded-[26px] bg-surface px-3.5" aria-label="Recent activities">{quickEntries.map((item,index)=>{const Icon=ACTIVITY_ICONS[item.kind];const subtitle=item.kind==="run"||item.kind==="walk"||item.kind==="cycling"?`${formatDuration(item.entry.duration_seconds)} · ${item.entry.distance_km.toFixed(1)} km`:`${formatDuration(item.entry.duration_seconds)}${item.entry.rounds?` · ${item.entry.rounds} rounds`:""}`;return <div key={`${item.kind}-${item.entry.id}`} className={`flex min-h-14 items-center gap-3 ${index?"border-t border-track":""}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full ${activityTint[item.kind]}`}><Icon size={18}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.kind==="boxing"?"Boxing":item.kind==="cycling"?"Ride":item.kind==="run"?"Run":"Walk"}</p><p className="truncate text-xs text-muted">{subtitle}</p></div><span className="text-xs text-muted">{item.entry.date===todayKey()?"Today":item.entry.date}</span><button onClick={()=>editQuickEntry(item)} className="h-9 rounded-full bg-field px-3 text-xs font-bold">Edit</button></div>;})}</section>}
      {!loading&&<div className="flex items-center justify-between pt-1"><h3 className="text-lg font-extrabold">Today</h3><span className="text-xs font-semibold text-muted">{todaySessions.length} activities</span></div>}
      {todaySessions.length>0&&<section className="rounded-[26px] bg-surface p-3" aria-label="Today's sessions">{todaySessions.slice(0,4).map((session)=><div key={session.id} className="flex min-h-12 items-center justify-between border-b border-track last:border-0"><span className="truncate text-sm font-bold">{session.template_name.replace(/^(Run|Walk|Cycling|Boxing):\s*/,"")}</span><span className="ml-2 shrink-0 text-xs text-muted">{formatDuration(session.total_duration_seconds)}</span></div>)}</section>}
      <div id="today-templates" className="scroll-mt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-lg font-extrabold">My workouts</h3><button onClick={()=>openEditor(null)} className="text-sm font-bold text-muted">+ Add</button></div>{loading?<WorkoutSkeleton/>:error?<div className="flex flex-col items-center py-12 text-red-400"><SmileySad size={40} className="mb-3 opacity-80"/><p>{error}</p></div>:templates.length===0?<div className="rounded-[26px] bg-surface p-6 text-center"><p className="mb-2 text-lg font-bold text-muted">No workout templates yet</p><button onClick={()=>openEditor(null)} className="rounded-full bg-accent px-5 py-3 font-bold text-on-accent">Create a workout</button></div>:<div className="space-y-2.5">{sortedTemplates.map((template)=><WorkoutCard key={template.id} template={template} onStart={onStartWorkout} onEdit={openEditor} onClone={cloneWorkout} onDelete={(id,name)=>setPendingDelete({id,name})} onLog={logWorkout} onTogglePin={togglePin} highlightId={highlightId}/>)}</div>}</div>
      <div className="fixed left-0 top-0 h-0 w-0 overflow-visible pointer-events-none"><RunLogger onRunLogged={handleActivityChanged} runType="run" editEntry={editRun} onEditHandled={()=>setEditRun(null)} openRequest={runRequest} hideTrigger/><RunLogger onRunLogged={handleActivityChanged} runType="walk" editEntry={editWalk} onEditHandled={()=>setEditWalk(null)} openRequest={walkRequest} hideTrigger/><CyclingLogger onWorkoutLogged={handleActivityChanged} editEntry={editCycling} onEditHandled={()=>setEditCycling(null)} openRequest={cyclingRequest} hideTrigger/><BoxingLogger onWorkoutLogged={handleActivityChanged} editEntry={editBoxing} onEditHandled={()=>setEditBoxing(null)} openRequest={boxingRequest} hideTrigger/></div>
      {showEditor&&<WorkoutEditor workout={editing} exercises={allExercises} onSave={onSave} onClose={()=>setShowEditor(false)}/>}
      {pendingDelete&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={()=>setPendingDelete(null)}><div ref={deleteModalRef} role="dialog" aria-modal="true" aria-label="Delete workout" className="w-full rounded-t-[32px] bg-surface px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] shadow-[var(--shadow-lg)] sm:max-w-sm sm:rounded-[26px]" onClick={(event)=>event.stopPropagation()}><h2 className="mb-1 text-lg font-bold">Delete workout?</h2><p className="mb-5 text-sm text-muted">Delete “{pendingDelete.name}”? This cannot be undone.</p><div className="flex gap-3"><button onClick={()=>setPendingDelete(null)} className="h-11 flex-1 rounded-xl border border-fg/10 font-semibold">Cancel</button><button onClick={()=>void confirmDelete()} className="h-11 flex-1 rounded-xl bg-red-500 text-on-accent font-semibold">Delete</button></div></div></div>}
      <RecentWorkouts onEdit={handleEditRequest} refreshKey={activityRefreshKey} onChanged={handleActivityChanged}/>
    </div>
  );
}
