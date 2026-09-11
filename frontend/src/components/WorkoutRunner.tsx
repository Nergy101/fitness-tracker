import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Exercise, type ExerciseLog, type WorkoutTemplate } from "../api";
import { soundStart, soundRest, soundFinish, speak, speakCue } from "../sound";
import { XIcon as X } from "@phosphor-icons/react";
import TopControls from "./TopControls";
import { localISO } from "../format";
import { useFocusTrap } from "../useFocusTrap";
import { useWakeLock } from "../useWakeLock";
import { randomNotePrompt } from "../notePrompts";
import WarmupScreen from "./workout-runner/WarmupScreen";
import RestScreen from "./workout-runner/RestScreen";
import RoundRestScreen from "./workout-runner/RoundRestScreen";
import ExerciseScreen from "./workout-runner/ExerciseScreen";
import CooldownScreen from "./workout-runner/CooldownScreen";
import FinishedScreen from "./workout-runner/FinishedScreen";
import StopConfirmDialog from "./workout-runner/StopConfirmDialog";
import SwapExercisePicker from "./workout-runner/SwapExercisePicker";
import { DEFAULT_REST, DEFAULT_KCAL_PER_MIN, RING, kcalFor, parseLogKey, validateReps, validateWeight } from "./workout-runner/utils";

import { logger } from "../logger";
type Phase = "warmup" | "cooldown" | "rest" | "exercise" | "roundrest" | "finished";



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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [swapSearch, setSwapSearch] = useState("");
  const swapRef = useRef<HTMLDivElement>(null);
  function closeSwap() { setShowSwapPicker(false); setSwapSearch(""); }
  useFocusTrap(swapRef, closeSwap);

  const filteredSwapExercises = useMemo(() => {
    const q = swapSearch.toLowerCase();
    return allExercises.filter((ex) => !q || ex.name.toLowerCase().includes(q));
  }, [allExercises, swapSearch]);
  const totalExercises = exercises.length;
  const mode = workout.mode || "circuit";
  const isAmrap = mode === "amrap";
  const isEmom = mode === "emom";
  const rounds = isAmrap ? 999 : Math.max(1, workout.rounds || 1);
  const restBetween = Math.max(0, workout.rest_between_rounds || 0);
  const timeCap = workout.time_cap_seconds || 1200;
  const warmupSeconds = workout.warmup_seconds || 0;
  const cooldownSeconds = workout.cooldown_seconds || 0;

  const [phase, setPhase] = useState<Phase>("rest");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [amrapRounds, setAmrapRounds] = useState(1);
  const [timer, setTimer] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const [restCountdown, setRestCountdown] = useState(DEFAULT_REST);
  const [restProgress, setRestProgress] = useState(0);
  const [longRest, setLongRest] = useState(false);
  const advanceRef = useRef<() => void>(() => {});

  const roundRef = useRef(0);
  const indexRef = useRef(0);
  const phaseRef = useRef<Phase>("rest");
  const halfwayCueRef = useRef(false);
  const tenSecCueRef = useRef(false);
  const amrapRoundRef = useRef(1);
  const pauseOffsetRef = useRef(0);
  const pauseStartRef = useRef(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

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

  const [weightError, setWeightError] = useState<string | null>(null);
  const [repsError, setRepsError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const [weightConfirm, setWeightConfirm] = useState(false);
  const [repsConfirm, setRepsConfirm] = useState(false);

  // Exercise logs: key = `${round}-${index}`, value = {weightKg, reps, rpe, notes}
  const [exerciseLogs, setExerciseLogs] = useState<
    Record<string, { weightKg: string; reps: string; rpe: number | null; notes: string }>
  >({});
  // NER-210: last weight/reps entered per exercise this session, so the next
  // set of the same exercise (and new exercises, from history) pre-fills.
  const [lastSetByExercise, setLastSetByExercise] = useState<
    Record<number, { weightKg: string; reps: string; rpe: number | null; notes: string }>
  >({});
  const [pastLogs, setPastLogs] = useState<Record<number, ExerciseLog[]>>({});
  const [sessionDate, setSessionDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [sessionNotes, setSessionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // NER-244: post-set rest countdown overlay. Shown after an exercise with a
  // logged set finishes, purely additive to the timer engine. Skipping clears
  // it; it never blocks progression.
  const REST_PRESETS = [30, 60, 90, 120];
  const [postRest, setPostRest] = useState<{ remaining: number; total: number } | null>(null);
  const prevPhaseRef = useRef<Phase>("rest");
  const prevRoundIndexRef = useRef(`${currentRound}-${currentIndex}`);
  const postRestIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Clear the interval on unmount.
    return () => {
      if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    // When we leave the "exercise" phase for a rest phase AND the exercise
    // that just finished had a logged set (weight or reps), show the post-set
    // rest countdown.
    const leftExercise = prevPhaseRef.current === "exercise" && phase === "rest";
    const key = `${currentRound}-${currentIndex}`;
    const finishedDifferentExercise = key !== prevRoundIndexRef.current;
    const hadSet = Object.values(exerciseLogs).some((v) => v.weightKg || v.reps);
    if (leftExercise && finishedDifferentExercise && hadSet) {
      const total = REST_PRESETS[1]; // default 60s
      setPostRest({ remaining: total, total });
      if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
      postRestIntervalRef.current = setInterval(() => {
        setPostRest((prev) => {
          if (!prev) return prev;
          if (prev.remaining <= 1) {
            if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
            // Beep + haptic at 0.
            try { soundStart(); } catch { /* noop */ }
            try { navigator.vibrate?.(200); } catch { /* noop */ }
            return null;
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    }
    prevPhaseRef.current = phase;
    prevRoundIndexRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound, currentIndex, exerciseLogs]);

  function skipPostRest() {
    if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
    setPostRest(null);
  }

  function setPostRestDuration(sec: number) {
    if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
    setPostRest({ remaining: sec, total: sec });
    postRestIntervalRef.current = setInterval(() => {
      setPostRest((prev) => {
        if (!prev) return prev;
        if (prev.remaining <= 1) {
          if (postRestIntervalRef.current) clearInterval(postRestIntervalRef.current);
          try { soundStart(); } catch { /* noop */ }
          try { navigator.vibrate?.(200); } catch { /* noop */ }
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }

  const notePrompt = useMemo(() => randomNotePrompt(), []);
  const savedRef = useRef(false);
  const savedSessionIdRef = useRef<number | null>(null);

  // Breathing cycle for cooldown: 4s inhale, 4s exhale
  const [breathPhase, setBreathPhase] = useState<"inhale" | "exhale">("inhale");
  const [breathProgress, setBreathProgress] = useState(0);
  const halfVibrateRef = useRef(false);

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
        }).catch(() => setLoadError("Could not load previous exercise data."));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.getExercises().then(setAllExercises).catch(() => setLoadError("Could not load exercises for swapping."));
  }, []);

  // Preload all exercise images so they're available offline once the workout starts
  useEffect(() => {
    exercises.forEach((e) => {
      const url = e.exercise?.image_url;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [exercises]);

  // Keep the screen awake for the whole session; released when finished or on unmount.
  useWakeLock(phase !== "finished");

  // Keyboard shortcuts (desktop): Space/Enter advance the current phase,
  // Escape opens the stop confirmation. Ignored while typing in an input or
  // when the swap picker / confirm dialog is open.
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSwapPicker) {
          closeSwap();
        } else if (confirmStop) {
          setConfirmStop(false);
        } else {
          setConfirmStop(true);
        }
        return;
      }
      if (confirmStop || phase === "finished") return;
      if ((e.key === " " || e.key === "Enter") && !isEditable(e.target)) {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, confirmStop, showSwapPicker]);

  const workDuration = useMemo(
    () =>
      exercises.reduce((sum, e) => sum + (e.duration_seconds || 30), 0) *
      (isAmrap ? 1 : rounds),
    [exercises, rounds, isAmrap],
  );
  const restDuration = Math.max(0, rounds - 1) * restBetween;
  const totalDuration = isAmrap ? timeCap : workDuration + restDuration + warmupSeconds + cooldownSeconds;

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

  // Used to navigate the runner back to a previously-logged set on "Undo last
  // set" — mirrors swapKeyRef's re-arm pattern so the timer engine restarts at
  // the target exercise instead of continuing forward.
  const backToRef = useRef<{ round: number; index: number } | null>(null);
  const backTickRef = useRef(0);

  useEffect(() => {
    // Helper: compute elapsed seconds accounting for pause offsets
    function calcElapsed(startTime: number): number {
      const now = Date.now();
      const liveOffset = pausedRef.current ? now - pauseStartRef.current : 0;
      return (now - startTime - pauseOffsetRef.current - liveOffset) / 1000;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const clear = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    function startWarmup() {
      if (warmupSeconds <= 0) {
        // No warmup, go straight to rest before first exercise
        startRest(0, 0);
        return;
      }
      roundRef.current = 0;
      indexRef.current = 0;
      phaseRef.current = "warmup";
      setPhase("warmup");
      setCurrentRound(0);
      setCurrentIndex(0);
      speak("Warmup");
      setTimer(warmupSeconds);
      setTimerProgress(0);
      const start = Date.now();
      clear();
      advanceRef.current = () => {
        clear();
        soundStart();
        startRest(0, 0);
      };
      intervalId = setInterval(() => {
        const elapsed = calcElapsed(start);
        setTimer(Math.max(0, warmupSeconds - elapsed));
        setTimerProgress(Math.min(1, elapsed / warmupSeconds));
        if (elapsed >= warmupSeconds) {
          clear();
          soundStart();
          startRest(0, 0);
        }
      }, 50);
    }

    function startCooldown() {
      if (cooldownSeconds <= 0) {
        finish();
        return;
      }
      roundRef.current = rounds;
      indexRef.current = totalExercises;
      phaseRef.current = "cooldown";
      setPhase("cooldown");
      setCurrentRound(rounds);
      setCurrentIndex(totalExercises);
      speak("Cooldown");
      setTimer(cooldownSeconds);
      setTimerProgress(0);
      const start = Date.now();
      clear();
      // Breathing cycle: 4s inhale, 4s exhale
      let breathStart = Date.now();
      let isInhale = true;
      const breathInterval = setInterval(() => {
        const bElapsed = calcElapsed(breathStart);
        const cycleSec = bElapsed % 8;
        if (cycleSec < 4) {
          if (!isInhale) { isInhale = true; breathStart = Date.now(); }
          setBreathPhase("inhale");
          setBreathProgress(cycleSec / 4);
        } else {
          if (isInhale) { isInhale = false; breathStart = Date.now(); }
          setBreathPhase("exhale");
          setBreathProgress((cycleSec - 4) / 4);
        }
      }, 50);
      advanceRef.current = () => {
        clear();
        clearInterval(breathInterval);
        soundFinish();
        finish();
      };
      intervalId = setInterval(() => {
        const elapsed = calcElapsed(start);
        setTimer(Math.max(0, cooldownSeconds - elapsed));
        setTimerProgress(Math.min(1, elapsed / cooldownSeconds));
        if (elapsed >= cooldownSeconds) {
          clear();
          clearInterval(breathInterval);
          soundFinish();
          finish();
        }
      }, 50);
    }

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
      halfVibrateRef.current = false;
      setLongRest(restSec > 60);
      speakCue(`Rest, ${restSec} seconds`);
      const restStart = Date.now();
      clear();
      advanceRef.current = () => {
        clear();
        soundStart();
        startExercise(round, i);
      };
      intervalId = setInterval(() => {
        const elapsed = calcElapsed(restStart);
        setRestCountdown(Math.max(0, Math.ceil(restSec - elapsed)));
        setRestProgress(Math.min(1, elapsed / restSec));
        // Halfway haptic alert for long rests (>60s)
        if (restSec > 60 && !halfVibrateRef.current && elapsed >= restSec / 2) {
          halfVibrateRef.current = true;
          try { navigator.vibrate([100]); } catch { /* silent fallback on desktop */ }
        }
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
        startCooldown();
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
      setLongRest(false);
      setCurrentRound(nextRound);
      setCurrentIndex(0);
      speak(`Next up: ${exercises[0]?.exercise?.name ?? "exercise"}`);
      speakCue(`Rest between rounds, ${restBetween} seconds`);
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
        const elapsed = calcElapsed(restStart);
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
      // NER-199: spoken countdown + one-shot halfway / 10s warnings (opt-in).
      speakCue("3, 2, 1, Go!");
      halfwayCueRef.current = false;
      tenSecCueRef.current = false;
      const start = Date.now();
      clear();
      advanceRef.current = () => advanceFrom(round, i);
      intervalId = setInterval(() => {
        const elapsed = calcElapsed(start);
        const remaining = dur - elapsed;
        setTimer(Math.max(0, remaining));
        setTimerProgress(Math.min(1, elapsed / dur));
        // Halfway cue at 50% of work duration.
        if (!halfwayCueRef.current && elapsed >= dur / 2) {
          halfwayCueRef.current = true;
          speakCue("Halfway");
        }
        // 10-second warning before the exercise ends.
        if (!tenSecCueRef.current && remaining <= 10 && remaining > 0) {
          tenSecCueRef.current = true;
          speakCue("10 seconds");
        }
        if (elapsed >= dur) advanceFrom(round, i);
      }, 50);
    }

    // ─── AMRAP global countdown ───────────────────────────
    let amrapInterval: ReturnType<typeof setInterval> | undefined;

    if (isAmrap) {
      const amrapStart = Date.now();
      amrapInterval = setInterval(() => {
        const elapsed = calcElapsed(amrapStart);
        if (elapsed >= timeCap) {
          if (amrapInterval) clearInterval(amrapInterval);
          clear();
          soundFinish();
          setPhase("finished");
        }
      }, 250);
    }

    // ─── EMOM minute clock ────────────────────────────────
    let emomInterval: ReturnType<typeof setInterval> | undefined;
    let emomStart = 0;

    if (isEmom) {
      emomStart = Date.now();
      emomInterval = setInterval(() => {
        const elapsed = calcElapsed(emomStart);
        const currentMinute = Math.floor(elapsed / 60);
        if (currentMinute >= totalExercises) {
          if (emomInterval) clearInterval(emomInterval);
          clear();
          soundFinish();
          setPhase("finished");
        }
      }, 250);
    }

    function finish() {
      clear();
      soundFinish();
      setPhase("finished");
    }

    if (totalExercises === 0) {
      finish();
    } else {
      // "Undo last set": jump the engine back to a previously-logged set's
      // exercise (regardless of current phase) so the user can re-log it.
      if (backTickRef.current > 0) {
        backTickRef.current = 0;
        const target = backToRef.current;
        backToRef.current = null;
        if (target) {
          startExercise(target.round, target.index);
          return;
        }
      }
      const r = roundRef.current;
      const i = indexRef.current;
      const p = phaseRef.current;
      if (swapKeyRef.current > 0 && p === "exercise") {
        startExercise(r, i);
      } else if (swapKeyRef.current > 0 && p === "warmup") {
        startWarmup();
      } else if (swapKeyRef.current > 0 && p === "cooldown") {
        startCooldown();
      } else if (swapKeyRef.current > 0) {
        startRest(r, i);
      } else {
        startWarmup();
      }
    }

    return () => {
      clear();
      if (amrapInterval) clearInterval(amrapInterval);
      if (emomInterval) clearInterval(emomInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/refs -- swapKeyRef.current is bumped before a forced re-render; reading it here re-arms the timer engine only on swap
  }, [exercises, totalExercises, rounds, restBetween, totalDuration, totalKcal, workout.id, workout.name, isAmrap, isEmom, timeCap, warmupSeconds, cooldownSeconds, swapKeyRef.current, backTickRef.current]);

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

  // NER-210: pre-fill weight/reps with the last values used for this exercise
  // this session, falling back to the most recent historical log so the first
  // set of a new exercise starts from where you left off last time.
  const prefillForCurrent = useMemo(() => {
    if (!currentExerciseId)
      return { weightKg: "", reps: "", rpe: null as number | null, notes: "" };
    const session = lastSetByExercise[currentExerciseId];
    if (session) return session;
    const logs = pastLogs[currentExerciseId];
    const last = logs && logs.length > 0 ? logs[0] : null;
    if (last) {
      return {
        weightKg: last.weight_kg != null ? String(last.weight_kg) : "",
        reps: last.reps != null ? String(last.reps) : "",
        rpe: last.rpe ?? null,
        notes: last.notes ?? "",
      };
    }
    return { weightKg: "", reps: "", rpe: null as number | null, notes: "" };
  }, [currentExerciseId, lastSetByExercise, pastLogs]);

  // NER-210: when a round of an exercise already logged this session starts,
  // auto-commit the last values so the repeated set is captured even if the
  // user doesn't touch the fields. Exercises only prefilled from history still
  // require interaction, so skipping them never logs a phantom set.
  useEffect(() => {
    if (phase !== "exercise" || !currentExerciseId) return;
    const session = lastSetByExercise[currentExerciseId];
    if (!session) return;
    setExerciseLogs((prev) => {
      if (prev[logKey]) return prev;
      return { ...prev, [logKey]: session };
    });
  }, [logKey, currentExerciseId, lastSetByExercise, phase]);

  // NER-210: update the current set's weight/reps, seeding from the prefill so
  // editing one field keeps the other, and remember per-exercise for next sets.
  const touchedLogKeysRef = useRef<Set<string>>(new Set());
  function updateLogEntry(
    field: "weightKg" | "reps" | "rpe" | "notes",
    value: string | number | null,
  ) {
    touchedLogKeysRef.current.add(logKey);
    const base = exerciseLogs[logKey] ?? prefillForCurrent;
    const next = { ...base, [field]: value } as {
      weightKg: string;
      reps: string;
      rpe: number | null;
      notes: string;
    };
    setExerciseLogs((prev) => ({ ...prev, [logKey]: next }));
    if (currentExerciseId != null) {
      setLastSetByExercise((prev) => ({ ...prev, [currentExerciseId]: next }));
    }
  }

  // Skipping an exercise must NOT save the auto-committed prefill — only sets
  // the user actively touched (typed into) survive a skip.
  function skipExercise() {
    if (!touchedLogKeysRef.current.has(logKey)) {
      setExerciseLogs((prev) => {
        const next = { ...prev };
        delete next[logKey];
        return next;
      });
    }
    advanceRef.current();
  }

  // NER-200: Keys of every set actually logged (weight or reps filled in), most
  // recent first (highest round, then highest index). Drives the "Undo last set" button.
  const loggedSetKeys = useMemo(
    () =>
      Object.entries(exerciseLogs)
        .filter(([, v]) => v.weightKg || v.reps)
        .map(([key]) => key)
        .sort((a, b) => {
          const A = parseLogKey(a);
          const B = parseLogKey(b);
          return B.round - A.round || B.index - A.index;
        }),
    [exerciseLogs],
  );

  const setCount = loggedSetKeys.length;

  // A "personal best" this session: any logged weight beats the exercise's
  // best previously-logged weight (first time ever logging it counts too).
  const hasPr = useMemo(
    () =>
      Object.entries(exerciseLogs).some(([key, v]) => {
        if (!v.weightKg) return false;
        const idx = parseInt(key.split("-")[1], 10);
        const exId = exercises[idx]?.exercise?.id ?? exercises[idx]?.exercise_id;
        if (exId == null) return false;
        const past = pastLogs[exId];
        if (!past || past.length === 0) return true;
        const pastMax = Math.max(...past.map((p) => p.weight_kg ?? 0));
        return parseFloat(v.weightKg) > pastMax;
      }),
    [exerciseLogs, exercises, pastLogs],
  );

  // Remove the most recently logged set, then return the runner to that
  // exercise so the user can re-log it correctly.
  function undoLastSet() {
    const mostRecent = loggedSetKeys[0];
    if (!mostRecent) return;
    const { round, index } = parseLogKey(mostRecent);
    // Clear the remembered last-set for that exercise too, so NER-210's
    // auto-commit doesn't immediately re-populate the field — the user should
    // re-log the set from a blank slate.
    const removedExerciseId =
      exercises[index]?.exercise?.id ?? exercises[index]?.exercise_id;
    setExerciseLogs((prev) => {
      const next = { ...prev };
      delete next[mostRecent];
      return next;
    });
    if (removedExerciseId != null) {
      setLastSetByExercise((prev) => {
        const next = { ...prev };
        delete next[removedExerciseId];
        return next;
      });
    }
    if (roundRef.current !== round || indexRef.current !== index) {
      backToRef.current = { round, index };
      backTickRef.current += 1;
      setCurrentRound(round);
      setCurrentIndex(index);
    }
  }
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

  // Dynamic rest timer color for long rests (>60s):
  //   start → accent, halfway → amber, last 10s → green
  const restTimerColor = useMemo(() => {
    if (phase !== "rest" || !longRest) return "var(--accent)";
    const remaining = Math.max(0, restCountdown);
    if (remaining <= 10) return "#22c55e";           // green: go!
    if (restProgress >= 0.5) return "#f59e0b";       // amber: halfway
    return "var(--accent)";
  }, [phase, longRest, restCountdown, restProgress]);

  // Persist the session as soon as the workout finishes (so it's never lost if
  // the user closes the summary) — capturing exercise logs entered during the
  // run. Notes/date typed on the summary screen are PATCHed in on Done. Reads
  // live state at call time (no stale closure); guarded against double-save.
  async function saveSession() {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    try {
      const session = await api.createSession({
        template_id: workout.id,
        template_name: workout.name || "",
        total_duration_seconds: totalDuration,
        total_kcal_estimated: totalKcal,
        notes: sessionNotes,
        started_at: localISO(sessionDate),
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
      savedSessionIdRef.current = session.id;

      // Attach weight/reps logs, matching by order_index so repeated
      // exercises don't collapse onto the first occurrence.
      const logPromises = session.exercises.map((se) => {
        const logEntries: {
          weightKg: string;
          reps: string;
          rpe: number | null;
          notes: string;
        }[] = [];
        Object.entries(exerciseLogs).forEach(([key, val]) => {
          const idx = parseInt(key.split("-")[1], 10);
          if (idx === se.order_index && (val.weightKg || val.reps)) {
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
              rpe: l.rpe ?? null,
              notes: l.notes ?? "",
            })),
          ).catch(() => {});
        }
        return null;
      });
      await Promise.all(logPromises.filter(Boolean));
      setSaving(false);
    } catch (err) {
      // Allow a retry (offline is queued by the api layer) rather than
      // silently dropping the session.
      savedRef.current = false;
      setSaving(false);
      logger.error("Failed to save session", err);
    }
  }

  // Fire the save exactly once, when the workout reaches the finished screen.
  useEffect(() => {
    if (phase === "finished") void saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveSession is guarded; only the phase transition should trigger it.
  }, [phase]);

  async function handleDone() {
    // Ensure the session exists (covers a failed auto-save), then fold in any
    // notes/date edited on the summary screen.
    if (!savedRef.current) await saveSession();
    const id = savedSessionIdRef.current;
    if (id != null) {
      try {
        await api.updateSession(id, {
          started_at: localISO(sessionDate),
          notes: sessionNotes,
        });
      } catch {
        /* offline/unreachable — the base session is already saved */
      }
    }
    onFinish();
  }

  return (
    <div className="workout-runner bg-bg h-full flex flex-col no-select">
      {postRest && phase !== "finished" && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6 pointer-events-none">
          <div className="w-full max-w-xs bg-surface rounded-2xl border border-fg/10 p-6 text-center pointer-events-auto">
            <p className="text-xs text-fg/40 uppercase tracking-wide mb-1">Rest between sets</p>
            <div className="relative w-32 h-32 mx-auto my-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--track)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="var(--accent)" strokeWidth="6"
                  strokeDasharray={RING}
                  strokeDashoffset={(1 - postRest.remaining / postRest.total) * RING}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-fg">{postRest.remaining}</span>
              </div>
            </div>
            <div className="flex justify-center gap-1.5 mb-4">
              {REST_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPostRestDuration(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    postRest.total === s
                      ? "bg-accent text-on-accent"
                      : "bg-bg text-fg/50 border border-fg/10 hover:text-fg"
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
            <button
              onClick={skipPostRest}
              aria-label="Skip rest timer"
              className="w-full bg-accent text-on-accent rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Skip rest timer
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-surface border border-red-400/30 text-red-300 rounded-xl px-4 py-2 text-sm shadow-lg">
          {loadError}
          <button className="ml-3 underline" onClick={() => setLoadError(null)}>Dismiss</button>
        </div>
      )}
      {showSwapPicker && (
        <SwapExercisePicker swapRef={swapRef} closeSwap={closeSwap} swapSearch={swapSearch} setSwapSearch={setSwapSearch} filteredSwapExercises={filteredSwapExercises} allExercises={allExercises} doSwap={doSwap} />
      )}

      {phase === "warmup" && (
        <WarmupScreen
          timerProgress={timerProgress}
          displayTime={displayTime}
          paused={paused}
          onSkip={() => advanceRef.current()}
          onTogglePause={() => (paused ? doResume() : doPause())}
        />
      )}
      {phase === "rest" && (
        <RestScreen currentName={currentName} currentImage={currentImage} currentCategory={exercises[currentIndex]?.exercise?.category} currentDescription={currentDescription} currentPastHint={currentPastHint} restTimerColor={restTimerColor} restProgress={restProgress} restCountdown={restCountdown} paused={paused} onSkip={() => advanceRef.current()} onTogglePause={() => (paused ? doResume() : doPause())} />
      )}
      {phase === "cooldown" && (
        <CooldownScreen timerProgress={timerProgress} displayTime={displayTime} breathPhase={breathPhase} breathProgress={breathProgress} paused={paused} onSkip={() => advanceRef.current()} onTogglePause={() => (paused ? doResume() : doPause())} />
      )}
      {phase === "roundrest" && (
        <RoundRestScreen currentRound={currentRound} isAmrap={isAmrap} rounds={rounds} restProgress={restProgress} restClock={restClock} paused={paused} onSkip={() => advanceRef.current()} onTogglePause={() => (paused ? doResume() : doPause())} />
      )}
      {phase === "exercise" && (
        <ExerciseScreen isAmrap={isAmrap} isEmom={isEmom} amrapRounds={amrapRounds} currentIndex={currentIndex} totalExercises={totalExercises} currentSupersetGroup={currentSupersetGroup} rounds={rounds} currentRound={currentRound} currentName={currentName} currentImage={currentImage} currentCategory={exercises[currentIndex]?.exercise?.category} currentDescription={currentDescription} currentPastHint={currentPastHint} weightValue={exerciseLogs[logKey]?.weightKg ?? prefillForCurrent.weightKg} repsValue={exerciseLogs[logKey]?.reps ?? prefillForCurrent.reps} onWeightChange={(v) => { const err = validateWeight(v); setWeightError(err && err.includes("Tap again") ? null : err); setWeightConfirm(err != null && err.includes("Tap again")); updateLogEntry("weightKg", v); }} onRepsChange={(v) => { const err = validateReps(v); setRepsError(err && err.includes("Tap again") ? null : err); setRepsConfirm(err != null && err.includes("Tap again")); updateLogEntry("reps", v); }} paused={paused} weightError={weightError} repsError={repsError} weightConfirm={weightConfirm} repsConfirm={repsConfirm} timerProgress={timerProgress} displayTime={displayTime} hasLoggedSets={loggedSetKeys.length > 0} onOpenSwap={() => setShowSwapPicker(true)} onSkip={skipExercise} onUndoLastSet={undoLastSet} onTogglePause={() => (paused ? doResume() : doPause())} rpeValue={exerciseLogs[logKey]?.rpe ?? prefillForCurrent.rpe} onRpeChange={(v) => updateLogEntry("rpe", v)} notesOpen={notesOpen} onToggleNotes={() => setNotesOpen((v) => !v)} notesValue={exerciseLogs[logKey]?.notes ?? prefillForCurrent.notes} onNotesChange={(v) => updateLogEntry("notes", v)} />
      )}
      {phase === "finished" && (
        <FinishedScreen isAmrap={isAmrap} timeCap={timeCap} totalDuration={totalDuration} totalExercises={totalExercises} amrapRounds={amrapRounds} setCount={setCount} totalKcal={totalKcal} hasPr={hasPr} workoutName={workout.name} sessionDate={sessionDate} setSessionDate={setSessionDate} notePrompt={notePrompt} sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} saving={saving} onDone={() => void handleDone()} />
      )}
      {phase !== "finished" && (
        <div className="absolute top-6 left-4">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-fg/40 hover:text-fg/70 text-sm px-3 py-1.5"
          >
            <X size={16} weight="bold" /> Stop
          </button>
        </div>
      )}

      <div className="absolute top-6 right-4">
        <TopControls />
      </div>

      {confirmStop && (
        <StopConfirmDialog onKeepGoing={() => setConfirmStop(false)} onStop={onCancel} />
      )}
    </div>
  );
}