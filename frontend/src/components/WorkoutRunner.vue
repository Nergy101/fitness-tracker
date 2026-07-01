<template>
  <div class="workout-runner bg-[#1e1e2e] h-full flex flex-col">
    <!-- Phase: NEXT_UP -->
    <div v-if="phase === 'rest'" class="flex flex-col items-center justify-center h-full px-6 text-center">
      <p class="text-white/50 text-sm mb-2">Next up</p>
      <h2 class="text-2xl font-bold text-white mb-6">{{ nextExerciseName }}</h2>
      <div class="relative w-48 h-48 mb-6">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff10" stroke-width="6"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#4cb782" stroke-width="6"
            :stroke-dasharray="264" :stroke-dashoffset="restProgress * 264"
            stroke-linecap="round" class="transition-all duration-300 ease-linear"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-5xl font-bold text-[#4cb782]">{{ restCountdown }}</span>
        </div>
      </div>
      <p class="text-white/30 text-sm">Get ready...</p>
    </div>

    <!-- Phase: EXERCISE -->
    <div v-else-if="phase === 'exercise'" class="flex flex-col items-center justify-center h-full px-6 text-center">
      <p class="text-white/50 text-sm mb-2">Exercise {{ currentIndex + 1 }} of {{ totalExercises }}</p>
      <h2 class="text-2xl font-bold text-white mb-6">{{ currentExerciseName }}</h2>
      <div class="relative w-48 h-48 mb-6">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff10" stroke-width="6"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#f97316" stroke-width="6"
            :stroke-dasharray="264" :stroke-dashoffset="(1 - timerProgress) * 264"
            stroke-linecap="round" class="transition-all duration-300 ease-linear"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-5xl font-bold text-white">{{ displayTime }}</span>
        </div>
      </div>
      <div class="w-full max-w-xs bg-white/10 rounded-full h-1.5 mb-4">
        <div class="bg-[#f97316] h-full rounded-full transition-all duration-300 ease-linear"
          :style="{ width: `${timerProgress * 100}%` }"></div>
      </div>
      <p class="text-white/30 text-sm">Go!</p>
    </div>

    <!-- Phase: FINISHED -->
    <div v-else class="flex flex-col items-center justify-center h-full px-6 text-center">
      <div class="w-20 h-20 bg-[#4cb782]/20 rounded-full flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4cb782" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h2 class="text-2xl font-bold text-white mb-2">Workout Complete!</h2>
      <p class="text-white/50 text-sm mb-6">{{ currentWorkoutName }}</p>

      <div class="grid grid-cols-3 gap-4 mb-8 w-full max-w-xs">
        <div class="bg-[#181825] rounded-xl p-3">
          <p class="text-2xl font-bold text-white">{{ Math.floor(totalDuration / 60) }}m</p>
          <p class="text-xs text-white/40">Duration</p>
        </div>
        <div class="bg-[#181825] rounded-xl p-3">
          <p class="text-2xl font-bold text-white">{{ totalExercises }}</p>
          <p class="text-xs text-white/40">Exercises</p>
        </div>
        <div class="bg-[#181825] rounded-xl p-3">
          <p class="text-2xl font-bold text-[#4cb782]">{{ Math.round(totalKcal) }}</p>
          <p class="text-xs text-white/40">Kcal</p>
        </div>
      </div>

      <button
        @click="$emit('finish')"
        class="bg-[#4cb782] text-[#1e1e2e] rounded-xl px-8 py-3 font-semibold hover:bg-[#5dd495] transition-colors"
      >
        Done
      </button>
    </div>

    <!-- Cancel (only during exercise/rest) -->
    <div v-if="phase !== 'finished'" class="absolute top-4 left-4">
      <button
        @click="cancelWorkout"
        class="text-white/40 hover:text-white/70 text-sm px-3 py-1.5"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { api } from '../api'

const props = defineProps({
  workout: { type: Object, required: true },
})
const emit = defineEmits(['finish', 'cancel'])

// State
const phase = ref('rest')  // 'rest' | 'exercise' | 'finished'
const currentIndex = ref(0)
const timer = ref(0)
const restCountdown = ref(5)
const timerProgress = ref(0)
const restProgress = ref(0)
let intervalId = null
let startTime = null

// Derived
const exercises = computed(() => props.workout.exercises || [])
const totalExercises = computed(() => exercises.value.length)
const currentExercise = computed(() => exercises.value[currentIndex.value] || {})
const currentExerciseName = computed(() => currentExercise.value.exercise?.name || currentExercise.value.exercise_name || 'Exercise')
const nextExercise = computed(() => exercises.value[currentIndex.value + 1] || {})
const nextExerciseName = computed(() => nextExercise.value.exercise?.name || nextExercise.value.exercise_name || '')
const currentDuration = computed(() => currentExercise.value.duration_seconds || 30)

const totalDuration = computed(() => {
  return exercises.value.reduce((sum, e) => sum + (e.duration_seconds || 30), 0) + (Math.max(0, exercises.value.length - 1) * 5)
})

const totalKcal = computed(() => {
  return exercises.value.reduce((sum, e) => {
    const dur = e.duration_seconds || 30
    const kpm = e.exercise?.default_kcal_per_min || 5
    return sum + (dur / 60) * kpm
  }, 0)
})

const displayTime = computed(() => {
  const s = Math.ceil(timer.value)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}`
})

const currentWorkoutName = computed(() => props.workout.name || 'Workout')

// Timer logic
function startExercise() {
  phase.value = 'exercise'
  timer.value = currentDuration.value
  timerProgress.value = 0
  startTime = Date.now()
  clearInterval(intervalId)
  intervalId = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000
    const remaining = currentDuration.value - elapsed
    timer.value = Math.max(0, remaining)
    timerProgress.value = elapsed / currentDuration.value

    if (elapsed >= currentDuration.value) {
      playBeep()
      nextTick(() => {
        if (currentIndex.value >= totalExercises.value - 1) {
          finishWorkout()
        } else {
          startRest()
        }
      })
    }
  }, 50)
}

function startRest() {
  phase.value = 'rest'
  restCountdown.value = 5
  restProgress.value = 0
  const restStart = Date.now()
  clearInterval(intervalId)
  intervalId = setInterval(() => {
    const elapsed = (Date.now() - restStart) / 1000
    restCountdown.value = Math.max(0, 5 - Math.floor(elapsed))
    restProgress.value = elapsed / 5

    if (elapsed >= 5) {
      currentIndex.value++
      playBeep()
      nextTick(startExercise)
    }
  }, 50)
}

function finishWorkout() {
  clearInterval(intervalId)
  phase.value = 'finished'
  saveSession()
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)

    // Also vibrate if available
    if (navigator.vibrate) navigator.vibrate(200)
  } catch (e) {
    // Audio context may not be available
  }
}

async function saveSession() {
  try {
    const sessionData = {
      template_id: props.workout.id,
      template_name: props.workout.name || '',
      total_duration_seconds: totalDuration.value,
      total_kcal_estimated: totalKcal.value,
      exercises: exercises.value.map((e, i) => ({
        exercise_id: e.exercise?.id || e.exercise_id,
        exercise_name: e.exercise?.name || e.exercise_name || '',
        duration_seconds: e.duration_seconds || 30,
        kcal_burned: ((e.duration_seconds || 30) / 60) * (e.exercise?.default_kcal_per_min || 5),
        order_index: i,
        completed: true,
      })),
    }
    await api.createSession(sessionData)
  } catch (e) {
    console.error('Failed to save session', e)
  }
}

function cancelWorkout() {
  clearInterval(intervalId)
  emit('cancel')
}

onMounted(() => {
  // Start with rest screen, then auto-begin after 5s
  startRest()
})

onUnmounted(() => {
  clearInterval(intervalId)
})
</script>