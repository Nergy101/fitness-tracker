<template>
  <div class="workout-tab">
    <!-- Header actions -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm text-white/50 font-medium">My Workouts</h2>
      <button
        @click="openEditor(null)"
        class="bg-[#4cb782] text-[#1e1e2e] rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#5dd495] transition-colors"
      >
        + New Workout
      </button>
    </div>

    <!-- Loading / Error / Empty -->
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else-if="templates.length === 0" class="text-center py-12">
      <p class="text-white/40 text-lg mb-2">No workout templates yet</p>
      <p class="text-white/30 text-sm mb-6">Create your first timed workout!</p>
    </div>

    <!-- Template list -->
    <div v-else class="space-y-3">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="bg-[#181825] rounded-xl p-4 border border-white/5"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 cursor-pointer" @click="startWorkout(tpl)">
            <h3 class="font-semibold text-base">{{ tpl.name }}</h3>
            <p v-if="tpl.description" class="text-white/50 text-sm mt-1">{{ tpl.description }}</p>
            <div class="flex gap-4 mt-2 text-xs text-white/40">
              <span>{{ tpl.exercises.length }} exercises</span>
              <span>{{ formatDuration(tpl.total_duration_seconds) }}</span>
            </div>
          </div>
          <div class="flex gap-2 ml-3">
            <button
              @click="openEditor(tpl)"
              class="text-white/30 hover:text-white/70 transition-colors p-1"
              title="Edit"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button
              @click="startWorkout(tpl)"
              class="bg-[#4cb782]/20 text-[#4cb782] rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-[#4cb782]/30 transition-colors"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Editor Modal -->
    <WorkoutEditor
      v-if="showEditor"
      :workout="editing"
      :exercises="allExercises"
      @save="onSave"
      @close="showEditor = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import WorkoutEditor from './WorkoutEditor.vue'

const templates = ref([])
const allExercises = ref([])
const loading = ref(true)
const error = ref(null)
const showEditor = ref(false)
const editing = ref(null)

const emit = defineEmits(['start-workout'])

onMounted(async () => {
  try {
    const [tpls, exs] = await Promise.all([api.getWorkouts(), api.getExercises()])
    templates.value = tpls
    allExercises.value = exs
  } catch (e) {
    error.value = 'Failed to load workouts'
  } finally {
    loading.value = false
  }
})

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function openEditor(tpl) {
  editing.value = tpl
  showEditor.value = true
}

async function onSave() {
  showEditor.value = false
  loading.value = true
  try {
    templates.value = await api.getWorkouts()
  } finally {
    loading.value = false
  }
}

function startWorkout(tpl) {
  emit('start-workout', tpl)
}
</script>