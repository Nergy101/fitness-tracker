import { useEffect, useMemo, useRef, useState } from "react";
import { api, type WorkoutTemplate } from "../api";
import { soundTabata, soundFinish } from "../sound";
import {
  PauseCircleIcon as PauseCircle,
  PlayCircleIcon as PlayCircle,
  SkipForwardIcon as SkipForward,
  XIcon as X,
} from "@phosphor-icons/react";
import ExerciseImage from "./ExerciseImage";
import TopControls from "./TopControls";
import { formatDuration, localISO } from "../format";

// Tabata is a fixed-interval HIIT format: 20s work / 10s rest, repeated for a
// configurable number of rounds (8 by default). Unlike the circuit runner it is
// round-centric rather than exercise-centric.
const WORK_SECONDS = 20;
const REST_SECONDS = 10;
const READY_SECONDS = 3;
const RING = 264;
const DEFAULT_KCAL_PER_MIN = 5;
const WORK_COLOR = "#f97316"; // orange-500
const REST_COLOR = "#22c55e"; // green-500

type TabataPhase = "ready" | "work" | "rest" | "finished";

interface Segment {
  kind: "ready" | "work" | "rest";
  dur: number;
  displayRound: number;
  exIdx: number | null;
}

interface TabataRunnerProps {
  workout: WorkoutTemplate;
  onFinish: () => void;
  onCancel: () => void;
}

function kcalFor(durationSeconds: number, kcalPerMin: number): number {
  return (durationSeconds / 60) * kcalPerMin;
}

export default function TabataRunner({ workout, onFinish, onCancel }: TabataRunnerProps) {
  const exercises = workout.exercises;
  const exerciseCount = exercises.length;
  const rounds = Math.max(1, workout.rounds || 8);

  // Fixed sequence, built up front: a short lead-in, then work/rest pairs with
  // no trailing rest after the final work interval. Exercises (if any) cycle
  // across rounds; the rest segment previews the upcoming round's exercise.
  const segments = useMemo<Segment[]>(() => {
    const cyc = (r: number) => (exerciseCount > 0 ? r % exerciseCount : null);
    const segs: Segment[] = [
      { kind: "ready", dur: READY_SECONDS, displayRound: 1, exIdx: cyc(0) },
    ];
    for (let r = 0; r < rounds; r++) {
      segs.push({ kind: "work", dur: WORK_SECONDS, displayRound: r + 1, exIdx: cyc(r) });
      if (r < rounds - 1) {
        segs.push({ kind: "rest", dur: REST_SECONDS, displayRound: r + 2, exIdx: cyc(r + 1) });
      }
    }
    return segs;
  }, [rounds, exerciseCount]);

  const totalDuration = rounds * WORK_SECONDS + Math.max(0, rounds - 1) * REST_SECONDS;
  const totalKcal = useMemo(() => {
    let sum = 0;
    for (let r = 0; r < rounds; r++) {
      const ex = exerciseCount > 0 ? exercises[r % exerciseCount] : null;
      sum += kcalFor(WORK_SECONDS, ex?.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN);
    }
    return sum;
  }, [exercises, exerciseCount, rounds]);

  const [phase, setPhase] = useState<TabataPhase>("ready");
  const [displayRound, setDisplayRound] = useState(1);
  const [exIdx, setExIdx] = useState<number | null>(exerciseCount > 0 ? 0 : null);
  const [timer, setTimer] = useState(READY_SECONDS);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  // Full-screen color flash on each transition — remounting via `flashKey`
  // replays the CSS animation from the top.
  const [flashColor, setFlashColor] = useState(WORK_COLOR);
  const [flashKey, setFlashKey] = useState(0);
  function doFlash(color: string) {
    setFlashColor(color);
    setFlashKey((k) => k + 1);
  }

  const pausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});
  const savedRef = useRef(false);

  const [sessionDate, setSessionDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  function doPause() {
    pausedRef.current = true;
    pauseStartRef.current = Date.now();
    setPaused(true);
  }
  function doResume() {
    pauseOffsetRef.current += Date.now() - pauseStartRef.current;
    pausedRef.current = false;
    setPaused(false);
  }

  useEffect(() => {
    let segIndex = 0;
    let segStart = Date.now();
    let intervalId: number | undefined;
    const clear = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    // Elapsed seconds in the current segment, discounting paused time.
    function calcElapsed(): number {
      const now = Date.now();
      const liveOffset = pausedRef.current ? now - pauseStartRef.current : 0;
      return (now - segStart - pauseOffsetRef.current - liveOffset) / 1000;
    }
    function begin(i: number) {
      if (i >= segments.length) {
        clear();
        setPhase("finished");
        soundFinish();
        return;
      }
      const seg = segments[i];
      segIndex = i;
      segStart = Date.now();
      pauseOffsetRef.current = 0;
      setPhase(seg.kind);
      setDisplayRound(seg.displayRound);
      setExIdx(seg.exIdx);
      setTimer(seg.dur);
      setProgress(0);
      if (seg.kind === "work") {
        soundTabata("work");
        doFlash(WORK_COLOR);
      } else if (seg.kind === "rest") {
        soundTabata("rest");
        doFlash(REST_COLOR);
      }
    }
    advanceRef.current = () => begin(segIndex + 1);
    begin(0);
    intervalId = window.setInterval(() => {
      const seg = segments[segIndex];
      const elapsed = calcElapsed();
      setTimer(Math.max(0, Math.ceil(seg.dur - elapsed)));
      setProgress(Math.min(1, elapsed / seg.dur));
      if (elapsed >= seg.dur) begin(segIndex + 1);
    }, 50);
    return () => clear();
  }, [segments]);

  async function saveSession() {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      await api.createSession({
        template_id: workout.id,
        template_name: workout.name || "",
        total_duration_seconds: totalDuration,
        total_kcal_estimated: totalKcal,
        started_at: localISO(sessionDate),
        exercises: Array.from({ length: rounds }, (_, r) => {
          const ex = exerciseCount > 0 ? exercises[r % exerciseCount] : null;
          return {
            exercise_id: ex?.exercise?.id ?? ex?.exercise_id ?? null,
            exercise_name: ex?.exercise?.name ?? "Tabata",
            duration_seconds: WORK_SECONDS,
            kcal_burned: kcalFor(
              WORK_SECONDS,
              ex?.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN,
            ),
            order_index: r,
            completed: true,
          };
        }),
      });
    } catch (err) {
      console.error("Failed to save session", err);
    }
  }

  async function handleDone() {
    await saveSession();
    onFinish();
  }

  const current = exIdx != null ? exercises[exIdx] : undefined;
  const currentName = current?.exercise?.name ?? "Tabata";
  const isWork = phase === "work";
  const isRest = phase === "rest";
  const isReady = phase === "ready";
  const ringColor = isRest ? REST_COLOR : WORK_COLOR;
  const bgTint = isWork
    ? `color-mix(in srgb, ${WORK_COLOR} 12%, var(--bg))`
    : isRest
      ? `color-mix(in srgb, ${REST_COLOR} 12%, var(--bg))`
      : "var(--bg)";

  return (
    <div
      className="workout-runner h-full flex flex-col no-select relative overflow-hidden"
      style={{ background: bgTint, transition: "background 300ms" }}
    >
      {/* Transition color flash */}
      {flashKey > 0 && (
        <div
          key={flashKey}
          className="absolute inset-0 pointer-events-none"
          style={{ background: flashColor, animation: "tabata-flash 500ms ease-out forwards" }}
        />
      )}

      {phase !== "finished" ? (
        <div className="relative flex flex-col items-center justify-center h-full px-6 text-center">
          <p
            className="text-sm font-semibold tracking-wide mb-1"
            style={{ color: isReady ? undefined : isWork ? WORK_COLOR : REST_COLOR }}
          >
            {isReady ? "Get ready" : isWork ? "WORK" : "REST"}
          </p>
          <h2 className="text-3xl font-bold text-fg mb-2">
            Round {displayRound}/{rounds}
          </h2>
          {exerciseCount > 0 && (
            <p className="text-base font-medium text-fg/70 mb-5">
              {isRest ? `Next: ${currentName}` : currentName}
            </p>
          )}

          <div className="relative w-56 h-56 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={isReady ? "var(--track)" : ringColor}
                strokeWidth="6"
                strokeDasharray={RING}
                strokeDashoffset={(1 - progress) * RING}
                strokeLinecap="round"
                className="transition-all duration-200 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-bold text-fg tabular-nums">{timer}</span>
              <span className="text-xs text-fg/40 mt-1">
                {isWork ? `${WORK_SECONDS}s work` : isRest ? `${REST_SECONDS}s rest` : "starting…"}
              </span>
            </div>
          </div>

          {current?.exercise && isWork && (
            <ExerciseImage
              src={current.exercise.image_url}
              alt={currentName}
              className="w-40 h-28 rounded-2xl mb-4 border border-fg/10"
              category={current.exercise.category}
            />
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => advanceRef.current()}
              className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
            >
              <SkipForward size={16} weight="fill" /> Skip
            </button>
            <button
              onClick={() => (paused ? doResume() : doPause())}
              className="inline-flex items-center gap-2 text-sm text-accent/60 hover:text-accent border border-accent/20 hover:border-accent/40 rounded-xl px-5 py-2 transition-colors"
            >
              {paused ? <PlayCircle size={16} weight="fill" /> : <PauseCircle size={16} weight="fill" />}
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-fg mb-2">Tabata Complete!</h2>
          <p className="text-fg/50 text-sm mb-6">{workout.name || "Workout"}</p>
          <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-xs">
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">{formatDuration(totalDuration)}</p>
              <p className="text-xs text-fg/40">Duration</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">{rounds}</p>
              <p className="text-xs text-fg/40">Rounds</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-accent">{Math.round(totalKcal)}</p>
              <p className="text-xs text-fg/40">Kcal</p>
            </div>
          </div>
          <div className="mb-5 w-full max-w-xs">
            <label className="text-xs text-fg/40 block mb-1.5">When was this workout?</label>
            <input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-2.5 text-sm text-fg outline-none focus:border-accent/50"
            />
          </div>
          <button
            onClick={handleDone}
            className="bg-accent text-on-accent rounded-xl px-8 py-3 font-semibold hover:bg-accent-hover transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {phase !== "finished" && (
        <div className="absolute top-4 left-4">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-fg/40 hover:text-fg/70 text-sm px-3 py-1.5"
          >
            <X size={16} weight="bold" /> Stop
          </button>
        </div>
      )}
      <div className="absolute top-4 right-4">
        <TopControls />
      </div>
    </div>
  );
}
