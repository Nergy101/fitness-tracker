<template>
  <div class="workout-tab">
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else-if="templates.length === 0" class="empty-state text-center py-12">
      <p class="text-white/40 text-lg mb-4">No workout templates yet</p>
      <p class="text-white/30 text-sm mb-6">Create your first workout to get started!</p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="bg-[#181825] rounded-xl p-4 border border-white/5 cursor-pointer hover:border-[#4cb782]/30 transition-colors"
        @click="startWorkout(tpl)"
      >
        <h3 class="font-semibold text-base">{{ tpl.name }}</h3>
        <p v-if="tpl.description" class="text-white/50 text-sm mt-1">{{ tpl.description }}</p>
        <div class="flex gap-4 mt-2 text-xs text-white/40">
          <span>{{ tpl.exercises.length }} exercises</span>
          <span>{{ formatDuration(tpl.total_duration_seconds) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const templates = ref([])
const loading = ref(true)
const error = ref(null)

const emit = defineEmits(['start-workout'])

onMounted(async () => {
  try {
    templates.value = await api.getWorkouts()
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

function startWorkout(tpl) {
  emit('start-workout', tpl)
}
</script>