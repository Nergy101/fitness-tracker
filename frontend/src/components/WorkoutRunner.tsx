import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Exercise, type ExerciseLog, type WorkoutTemplate } from "../api";
import { soundStart, soundRest, soundFinish, speak } from "../sound";
import {
  ArrowsLeftRightIcon as ArrowsLeftRight,
  SkipForwardIcon as SkipForward,
  XIcon as X,
} from "@phosphor-icons/react";
import ExerciseImage from "./ExerciseImage";
import TopControls from "./TopControls";
import { formatDuration } from "../format";

type Phase = "rest" | "exercise" | "roundrest" | "finished";

const DEFAULT_REST = 5;
const DEFAULT_KCAL_PER_MIN = 5;
const RING = 264;

function kcalFor(durationSeconds: number, kcalPerMin: number): number {
  return (durationSeconds / 60) * kcalPerMin;
}

interface WorkoutRunnerProps {
  workout: WorkoutTemplate;
  onFinish: () => void;
  onCancel: () => void;
}

export default function WorkoutRunner({
  workout,
  onFinish,
  onCancel,
}: WorkoutRunnerProps) {
  const [exercises, setExercises] = useState(workout.exercises);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const totalExercises = exercises.length;
  const mode = workout.mode || "circuit";
  const isAmrap = mode === "amrap";
  const isEmom = mode === "emom";
  const rounds = isAmrap ? 999 : Math.max(1, workout.rounds || 1);
  const restBetween = Math.max(0, workout.rest_between_rounds || 0);
  const timeCap = workout.time_cap_seconds || 1200;

  const [phase, setPhase] = useState<Phase>("rest");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [amrapRounds, setAmrapRounds] = useState(1);
  const [timer, setTimer] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const [restCountdown, setRestCountdown] = useState(DEFAULT_REST);
  const [restProgress, setRestProgress] = useState(0);
  const advanceRef = useRef<() => void>(() => {});

  const roundRef = useRef(0);
  const indexRef = useRef(0);
  const phaseRef = useRef<Phase>("rest");
  const amrapRoundRef = useRef(1);

  // Exercise logs: key = `${round}-${index}`, value = {weightKg, reps}
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, { weightKg: string; reps: string }>>({});
  const [pastLogs, setPastLogs] = useState<Record<number, ExerciseLog[]>>({});

  useEffect(() => {
    // Fetch last session's logs for each exercise to show hints
    exercises.forEach((e) => {
      const exId = e.exercise?.id ?? e.exercise_id;
      if (exId && !pastLogs[exId]) {
        api.getExerciseLogs(exId, 1).then((logs) => {
          setPastLogs((prev) => {
            if (prev[exId]) return prev;
            return { ...prev, [exId]: logs };
          });
        }).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.getExercises().then(setAllExercises).catch(() => {});
  }, []);

  const workDuration = useMemo(
    () =>
      exercises.reduce((sum, e) => sum + (e.duration_seconds || 30), 0) *
      (isAmrap ? 1 : rounds),
    [exercises, rounds, isAmrap],
  );
  const restDuration = Math.max(0, rounds - 1) * restBetween;
  const totalDuration = isAmrap ? timeCap : workDuration + restDuration;

  const totalKcal = useMemo(
    () =>
      exercises.reduce(
        (sum, e) =>
          sum +
          kcalFor(
            e.duration_seconds || 30,
            e.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN,
          ),
        0,
      ) * (isAmrap ? 1 : rounds),
    [exercises, rounds, isAmrap],
  );

  const doSwap = (newExercise: Exercise) => {
    setExercises((prev) => {
      const next = [...prev];
      next[indexRef.current] = {
        ...next[indexRef.current],
        exercise_id: newExercise.id,
        exercise: newExercise,
      };
      return next;
    });
    setShowSwapPicker(false);
    swapKeyRef.current += 1;
  };

  const swapKeyRef = useRef(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const clear = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    function startRest(round: number, i: number) {
      roundRef.current = round;
      indexRef.current = i;
      phaseRef.current = "rest";
      setPhase("rest");
      setCurrentRound(round);
      setCurrentIndex(i);
      speak(`Next up: ${exercises[i]?.exercise?.name ?? "exercise"}`);
      const restSec =
        i === 0
          ? DEFAULT_REST
          : (exercises[i - 1]?.rest_after_seconds || DEFAULT_REST);
      setRestCountdown(restSec);
      setRestProgress(0);
      const restStart = Date.now();
      clear();
      advanceRef.current = () => {
        clear();
        soundStart();
        startExercise(round, i);
      };
      intervalId = setInterval(() => {
        const elapsed = (Date.now() - restStart) / 1000;
        setRestCountdown(Math.max(0, Math.ceil(restSec - elapsed)));
        setRestProgress(Math.min(1, elapsed / restSec));
        if (elapsed >= restSec) {
          clear();
          soundStart();
          startExercise(round, i);
        }
      }, 50);
    }

    function advanceFrom(round: number, i: number) {
      clear();
      if (i < totalExercises - 1) {
        // Skip rest if next exercise is in the same superset group
        const curGroup = exercises[i]?.superset_group;
        const nextGroup = exercises[i + 1]?.superset_group;
        if (curGroup != null && curGroup === nextGroup) {
          soundStart();
          startExercise(round, i + 1);
        } else {
          soundRest();
          startRest(round, i + 1);
        }
      } else if (isAmrap) {
        // AMRAP: loop back to exercise 0, increment amrap round
        soundRest();
        amrapRoundRef.current += 1;
        setAmrapRounds(amrapRoundRef.current);
        startRest(round + 1, 0);
      } else if (round < rounds - 1) {
        soundRest();
        startRoundRest(round + 1);
      } else {
        finish();
      }
    }

    function startRoundRest(nextRound: number) {
      if (restBetween <= 0) {
        startExercise(nextRound, 0);
        return;
      }
      roundRef.current = nextRound;
      indexRef.current = 0;
      phaseRef.current = "roundrest";
      setPhase("roundrest");
      setCurrentRound(nextRound);
      setCurrentIndex(0);
      speak(`Next up: ${exercises[0]?.exercise?.name ?? "exercise"}`);
      setRestCountdown(restBetween);
      setRestProgress(0);
      const restStart = Date.now();
      clear();
      advanceRef.current = () => {
        clear();
        soundStart();
        startExercise(nextRound, 0);
      };
      intervalId = setInterval(() => {
        const elapsed = (Date.now() - restStart) / 1000;
        setRestCountdown(Math.max(0, Math.ceil(restBetween - elapsed)));
        setRestProgress(Math.min(1, elapsed / restBetween));
        if (elapsed >= restBetween) {
          clear();
          soundStart();
          startExercise(nextRound, 0);
        }
      }, 50);
    }

    function startExercise(round: number, i: number) {
      roundRef.current = round;
      indexRef.current = i;
      phaseRef.current = "exercise";
      setPhase("exercise");
      setCurrentRound(round);
      setCurrentIndex(i);
      const dur = exercises[i]?.duration_seconds || 30;
      setTimer(dur);
      setTimerProgress(0);
      const start = Date.now();
      clear();
      advanceRef.current = () => advanceFrom(round, i);
      intervalId = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        setTimer(Math.max(0, dur - elapsed));
        setTimerProgress(Math.min(1, elapsed / dur));
        if (elapsed >= dur) advanceFrom(round, i);
      }, 50);
    }

    // ─── AMRAP global countdown ───────────────────────────
    let amrapInterval: ReturnType<typeof setInterval> | undefined;

    if (isAmrap) {
      const amrapStart = Date.now();
      amrapInterval = setInterval(() => {
        const elapsed = (Date.now() - amrapStart) / 1000;
        if (elapsed >= timeCap) {
          if (amrapInterval) clearInterval(amrapInterval);
          clear();
          soundFinish();
          setPhase("finished");
          void saveSession();
        }
      }, 250);
    }

    // ─── EMOM minute clock ────────────────────────────────
    let emomInterval: ReturnType<typeof setInterval> | undefined;
    let emomStart = 0;

    if (isEmom) {
      emomStart = Date.now();
      emomInterval = setInterval(() => {
        const elapsed = (Date.now() - emomStart) / 1000;
        const currentMinute = Math.floor(elapsed / 60);
        if (currentMinute >= totalExercises) {
          if (emomInterval) clearInterval(emomInterval);
          clear();
          soundFinish();
          setPhase("finished");
          void saveSession();
        }
      }, 250);
    }

    async function saveSession() {
      try {
        const session = await api.createSession({
          template_id: workout.id,
          template_name: workout.name || "",
          total_duration_seconds: totalDuration,
          total_kcal_estimated: totalKcal,
          exercises: exercises.map((e, i) => ({
            exercise_id: e.exercise?.id ?? e.exercise_id,
            exercise_name: e.exercise?.name || "",
            duration_seconds: e.duration_seconds || 30,
            kcal_burned: kcalFor(
              e.duration_seconds || 30,
              e.exercise?.default_kcal_per_min ?? DEFAULT_KCAL_PER_MIN,
            ),
            order_index: i,
            completed: true,
          })),
        });

        // Save exercise logs for any exercise that had weight/reps entered
        const logPromises = session.exercises.map((se) => {
          // Find all log entries for this exercise by matching exercise_id
          const logEntries: { weightKg: string; reps: string }[] = [];
          Object.entries(exerciseLogs).forEach(([key, val]) => {
            const idx = parseInt(key.split("-")[1], 10);
            if (exercises[idx]?.exercise_id === se.exercise_id && (val.weightKg || val.reps)) {
              logEntries.push(val);
            }
          });
          if (logEntries.length > 0) {
            return api.createExerciseLogs(
              session.id,
              se.id,
              logEntries.map((l, i) => ({
                weight_kg: l.weightKg ? parseFloat(l.weightKg) : null,
                reps: l.reps ? parseInt(l.reps, 10) : null,
                set_number: i + 1,
              })),
            ).catch(() => {});
          }
          return null;
        });
        await Promise.all(logPromises.filter(Boolean));
      } catch (err) {
        console.error("Failed to save session", err);
      }
    }

    function finish() {
      clear();
      soundFinish();
      setPhase("finished");
      void saveSession();
    }

    if (totalExercises === 0) {
      finish();
    } else {
      const r = roundRef.current;
      const i = indexRef.current;
      const p = phaseRef.current;
      if (swapKeyRef.current > 0 && p === "exercise") {
        startExercise(r, i);
      } else if (swapKeyRef.current > 0) {
        startRest(r, i);
      } else {
        startRest(0, 0);
      }
    }

    return () => {
      clear();
      if (amrapInterval) clearInterval(amrapInterval);
      if (emomInterval) clearInterval(emomInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/refs -- swapKeyRef.current is bumped before a forced re-render; reading it here re-arms the timer engine only on swap
  }, [exercises, totalExercises, rounds, restBetween, totalDuration, totalKcal, workout.id, workout.name, isAmrap, isEmom, timeCap, swapKeyRef.current]);

  const currentName = exercises[currentIndex]?.exercise?.name ?? "Exercise";
  const currentImage = exercises[currentIndex]?.exercise?.image_url ?? null;
  const currentDescription = exercises[currentIndex]?.exercise?.description ?? "";
  const currentExerciseId = exercises[currentIndex]?.exercise?.id ?? exercises[currentIndex]?.exercise_id;
  const currentSupersetGroup = exercises[currentIndex]?.superset_group ?? null;
  const logKey = `${currentRound}-${currentIndex}`;
  const currentPastHint = useMemo(() => {
    if (!currentExerciseId) return null;
    const logs = pastLogs[currentExerciseId];
    if (!logs || logs.length === 0) return null;
    const last = logs[0];
    const parts: string[] = [];
    if (last.weight_kg != null) parts.push(`${last.weight_kg}kg`);
    if (last.reps != null) parts.push(`${last.reps} reps`);
    if (parts.length === 0) return null;
    return `Last time: ${parts.join(" × ")}`;
  }, [currentExerciseId, pastLogs]);
  const displayTime = (() => {
    const s = Math.ceil(timer);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}`;
  })();
  const restClock = (() => {
    const s = Math.max(0, restCountdown);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  })();

  return (
    <div className="workout-runner bg-bg h-full flex flex-col no-select">
      {showSwapPicker && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowSwapPicker(false)}
        >
          <div
            className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-fg/10 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Swap Exercise</h3>
              <button
                onClick={() => setShowSwapPicker(false)}
                className="text-fg/40 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {allExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => doSwap(ex)}
                  className="w-full text-left bg-bg rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-fg/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-fg/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {ex.image_url ? (
                      <img src={ex.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-fg/30 text-lg font-bold">{ex.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ex.name}</p>
                    <p className="text-[10px] text-fg/40 capitalize">{ex.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "rest" && (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <p className="text-fg/50 text-sm mb-2">Next up</p>
          <h2 className="text-2xl font-bold text-fg mb-6">{currentName}</h2>
          <ExerciseImage
            src={currentImage}
            alt={currentName}
            iconSize={48}
            className="w-56 h-40 rounded-2xl mb-3 border border-fg/10"
          />
          {currentDescription && (
            <p className="text-fg/50 text-sm max-w-xs mb-3">{currentDescription}</p>
          )}
          {currentPastHint && (
            <p className="text-accent/70 text-xs mb-4 font-medium">{currentPastHint}</p>
          )}
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="var(--accent)" strokeWidth="6"
                strokeDasharray={RING}
                strokeDashoffset={restProgress * RING}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-bold text-accent">{restCountdown}</span>
            </div>
          </div>
          <p className="text-fg/30 text-sm mb-4">Get ready...</p>
          <button
            onClick={() => advanceRef.current()}
            className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
          >
            <SkipForward size={16} weight="fill" /> Skip rest
          </button>
        </div>
      )}

      {phase === "roundrest" && (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <p className="text-fg/50 text-sm mb-2">Round rest</p>
          <h2 className="text-2xl font-bold text-fg mb-6">
            Round {currentRound + 1}/{isAmrap ? "∞" : rounds} next
          </h2>
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="var(--accent)" strokeWidth="6"
                strokeDasharray={RING}
                strokeDashoffset={restProgress * RING}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-accent">{restClock}</span>
            </div>
          </div>
          <p className="text-fg/30 text-sm mb-4">Catch your breath</p>
          <button
            onClick={() => advanceRef.current()}
            className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
          >
            <SkipForward size={16} weight="fill" /> Skip rest
          </button>
        </div>
      )}

      {phase === "exercise" && (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <p className="text-fg/50 text-sm mb-2">
            {isAmrap ? `Round ${amrapRounds}` : isEmom ? `Exercise ${currentIndex + 1} of ${totalExercises}` : `Exercise ${currentIndex + 1} of ${totalExercises}`}
            {currentSupersetGroup && (
              <span className="text-accent/70 ml-1.5 font-semibold text-xs">SS</span>
            )}
            {!isAmrap && !isEmom && rounds > 1 && (
              <span className="text-accent"> &middot; Round {currentRound + 1}/{rounds}</span>
            )}
            {isAmrap && (
              <span className="text-accent"> &middot; AMRAP</span>
            )}
          </p>
          <h2 className="text-2xl font-bold text-fg mb-6">
            {currentName}
            <button
              onClick={() => setShowSwapPicker(true)}
              className="ml-2 inline-flex items-center text-fg/30 hover:text-accent transition-colors align-middle"
              title="Swap exercise"
            >
              <ArrowsLeftRight size={20} weight="bold" />
            </button>
          </h2>
          <ExerciseImage
            src={currentImage}
            alt={currentName}
            iconSize={48}
            className="w-56 h-40 rounded-2xl mb-3 border border-fg/10"
          />
          {currentDescription && (
            <p className="text-fg/50 text-sm max-w-xs mb-3">{currentDescription}</p>
          )}
          {currentPastHint && (
            <p className="text-accent/70 text-xs mb-3 font-medium">{currentPastHint}</p>
          )}
          {/* Weight / reps logging */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="number"
              inputMode="decimal"
              placeholder="kg"
              value={exerciseLogs[logKey]?.weightKg ?? ""}
              onChange={(e) => setExerciseLogs((prev) => ({
                ...prev,
                [logKey]: { ...(prev[logKey] ?? { weightKg: "", reps: "" }), weightKg: e.target.value },
              }))}
              className="w-20 bg-surface border border-fg/10 rounded-lg px-3 py-2 text-center text-sm text-fg placeholder-fg/20 focus:outline-none focus:border-accent/50"
              aria-label="Weight in kg"
            />
            <span className="text-fg/20 text-sm">×</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="reps"
              value={exerciseLogs[logKey]?.reps ?? ""}
              onChange={(e) => setExerciseLogs((prev) => ({
                ...prev,
                [logKey]: { ...(prev[logKey] ?? { weightKg: "", reps: "" }), reps: e.target.value },
              }))}
              className="w-20 bg-surface border border-fg/10 rounded-lg px-3 py-2 text-center text-sm text-fg placeholder-fg/20 focus:outline-none focus:border-accent/50"
              aria-label="Reps"
            />
          </div>
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={isAmrap ? "#f97316" : "var(--timer)"}
                strokeWidth="6"
                strokeDasharray={RING}
                strokeDashoffset={(1 - timerProgress) * RING}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-bold text-fg">{displayTime}</span>
            </div>
          </div>
          {isAmrap && (
            <p className="text-fg/30 text-xs mb-1">Rounds completed: {amrapRounds}</p>
          )}
          <p className="text-fg/30 text-sm">{isAmrap ? "Go!" : isEmom ? "Go!" : "Go!"}</p>
          <button
            onClick={() => advanceRef.current()}
            className="mt-4 inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg border border-fg/15 rounded-xl px-5 py-2 transition-colors"
          >
            <SkipForward size={16} weight="fill" /> Skip
          </button>
        </div>
      )}

      {phase === "finished" && (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-fg mb-2">
            {isAmrap ? "Time!" : "Workout Complete!"}
          </h2>
          <p className="text-fg/50 text-sm mb-6">{workout.name || "Workout"}</p>

          <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-xs">
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">
                {isAmrap ? formatDuration(timeCap) : `${Math.floor(totalDuration / 60)}m`}
              </p>
              <p className="text-xs text-fg/40">Duration</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">
                {isAmrap ? amrapRounds : totalExercises}
              </p>
              <p className="text-xs text-fg/40">{isAmrap ? "Rounds" : "Exercises"}</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-accent">{Math.round(totalKcal)}</p>
              <p className="text-xs text-fg/40">Kcal</p>
            </div>
          </div>

          {isAmrap && (
            <p className="text-fg/40 text-sm mb-4">
              {amrapRounds} round{amrapRounds !== 1 ? "s" : ""} in {formatDuration(timeCap)}
            </p>
          )}

          <button
            onClick={onFinish}
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