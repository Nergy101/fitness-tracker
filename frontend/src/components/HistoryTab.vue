<template>
  <div class="history-tab">
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else-if="sessions.length === 0" class="empty-state text-center py-12">
      <p class="text-white/40 text-lg mb-2">No sessions yet</p>
      <p class="text-white/30 text-sm">Complete a workout to see your history here!</p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="bg-[#181825] rounded-xl p-4 border border-white/5"
      >
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-sm">{{ session.template_name }}</h3>
          <span class="text-xs text-white/40">{{ formatDate(session.started_at) }}</span>
        </div>
        <div class="flex gap-4 mt-2 text-xs text-white/50">
          <span>{{ formatDuration(session.total_duration_seconds) }}</span>
          <span>{{ session.exercises.length }} exercises</span>
          <span>~{{ Math.round(session.total_kcal_estimated) }} kcal</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const sessions = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    sessions.value = await api.getSessions()
  } catch (e) {
    error.value = 'Failed to load sessions'
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

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>