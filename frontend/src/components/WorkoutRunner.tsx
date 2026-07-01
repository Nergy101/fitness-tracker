import { useEffect, useMemo, useRef, useState } from "react";
import { api, type WorkoutTemplate } from "../api";
import { soundStart, soundRest, soundFinish, speak } from "../sound";
import { SkipForward, X } from "@phosphor-icons/react";
import ExerciseImage from "./ExerciseImage";
import TopControls from "./TopControls";

type Phase = "rest" | "exercise" | "roundrest" | "finished";

const REST_SECONDS = 5;
const DEFAULT_KCAL_PER_MIN = 5;
const RING = 264; // 2πr, r=42

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
  const exercises = workout.exercises;
  const totalExercises = exercises.length;
  const rounds = Math.max(1, workout.rounds || 1);
  const restBetween = Math.max(0, workout.rest_between_rounds || 0);

  const [phase, setPhase] = useState<Phase>("rest");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [timer, setTimer] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const [restCountdown, setRestCountdown] = useState(REST_SECONDS);
  const [restProgress, setRestProgress] = useState(0);
  // Set during each exercise; the Skip button jumps to the next exercise/round.
  const advanceRef = useRef<() => void>(() => {});

  // Work = exercise time × rounds. Rest = configured between-round rest ×
  // (rounds − 1). Total = work + rest — matches the backend breakdown.
  const workDuration = useMemo(
    () =>
      exercises.reduce((sum, e) => sum + (e.duration_seconds || 30), 0) * rounds,
    [exercises, rounds],
  );
  const restDuration = Math.max(0, rounds - 1) * restBetween;
  const totalDuration = workDuration + restDuration;

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
      ) * rounds,
    [exercises, rounds],
  );

  // Timed state machine. Runs once on mount; the interval closes over local
  // timestamps and stable props only, so there is no stale-state hazard.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const clear = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    // rest(round, i) precedes exercise(round, i) for every exercise in every
    // round, so nothing is skipped.
    function startRest(round: number, i: number) {
      setPhase("rest");
      setCurrentRound(round);
      setCurrentIndex(i);
      speak(`Next up: ${exercises[i]?.exercise?.name ?? "exercise"}`);
      setRestCountdown(REST_SECONDS);
      setRestProgress(0);
      const restStart = Date.now();
      clear();
      intervalId = setInterval(() => {
        const elapsed = (Date.now() - restStart) / 1000;
        setRestCountdown(Math.max(0, REST_SECONDS - Math.floor(elapsed)));
        setRestProgress(Math.min(1, elapsed / REST_SECONDS));
        if (elapsed >= REST_SECONDS) {
          clear();
          soundStart();
          startExercise(round, i);
        }
      }, 50);
    }

    function advanceFrom(round: number, i: number) {
      clear();
      if (i < totalExercises - 1) {
        soundRest();
        startRest(round, i + 1);
      } else if (round < rounds - 1) {
        soundRest();
        startRoundRest(round + 1);
      } else {
        finish();
      }
    }

    // Configurable rest between rounds. Replaces the short get-ready before the
    // first exercise of the next round.
    function startRoundRest(nextRound: number) {
      if (restBetween <= 0) {
        startExercise(nextRound, 0);
        return;
      }
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

    function finish() {
      clear();
      soundFinish();
      setPhase("finished");
      void saveSession();
    }

    async function saveSession() {
      try {
        await api.createSession({
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
      } catch (err) {
        console.error("Failed to save session", err);
      }
    }

    if (totalExercises === 0) {
      finish();
    } else {
      startRest(0, 0);
    }

    return clear;
  }, [exercises, totalExercises, rounds, restBetween, totalDuration, totalKcal, workout.id, workout.name]);

  const currentName = exercises[currentIndex]?.exercise?.name ?? "Exercise";
  const currentImage = exercises[currentIndex]?.exercise?.image_url ?? null;
  const currentDescription = exercises[currentIndex]?.exercise?.description ?? "";
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
            <p className="text-fg/50 text-sm max-w-xs mb-5">{currentDescription}</p>
          )}
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
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
          <p className="text-fg/30 text-sm">Get ready...</p>
        </div>
      )}

      {phase === "roundrest" && (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <p className="text-fg/50 text-sm mb-2">Round rest</p>
          <h2 className="text-2xl font-bold text-fg mb-6">
            Round {currentRound + 1}/{rounds} next
          </h2>
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
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
            Exercise {currentIndex + 1} of {totalExercises}
            {rounds > 1 && (
              <span className="text-accent"> &middot; Round {currentRound + 1}/{rounds}</span>
            )}
          </p>
          <h2 className="text-2xl font-bold text-fg mb-6">{currentName}</h2>
          <ExerciseImage
            src={currentImage}
            alt={currentName}
            iconSize={48}
            className="w-56 h-40 rounded-2xl mb-3 border border-fg/10"
          />
          {currentDescription && (
            <p className="text-fg/50 text-sm max-w-xs mb-5">{currentDescription}</p>
          )}
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--timer)"
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
          <p className="text-fg/30 text-sm">Go!</p>
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
          <h2 className="text-2xl font-bold text-fg mb-2">Workout Complete!</h2>
          <p className="text-fg/50 text-sm mb-6">{workout.name || "Workout"}</p>

          <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-xs">
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">{Math.floor(totalDuration / 60)}m</p>
              <p className="text-xs text-fg/40">Duration</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-fg">{totalExercises}</p>
              <p className="text-xs text-fg/40">Exercises</p>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-accent">{Math.round(totalKcal)}</p>
              <p className="text-xs text-fg/40">Kcal</p>
            </div>
          </div>

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

      {/* Theme + mute stay reachable throughout the workout. */}
      <div className="absolute top-4 right-4">
        <TopControls variant="overlay" />
      </div>
    </div>
  );
}
