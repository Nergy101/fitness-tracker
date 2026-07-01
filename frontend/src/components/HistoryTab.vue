<template>
  <div class="history-tab">
    <!-- Stats Dashboard -->
    <div v-if="!loading && sessions.length > 0" class="bg-[#181825] rounded-xl p-4 border border-white/5 mb-4">
      <div class="grid grid-cols-4 gap-2 mb-3">
        <div class="text-center">
          <p class="text-lg font-bold text-white">{{ stats.totalSessions }}</p>
          <p class="text-[10px] text-white/40">Workouts</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-bold text-white">{{ formatHours(stats.totalMinutes) }}</p>
          <p class="text-[10px] text-white/40">Total Time</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-bold text-[#4cb782]">{{ Math.round(stats.totalKcal) }}</p>
          <p class="text-[10px] text-white/40">Kcal</p>
        </div>
        <div class="text-center">
          <p class="text-lg font-bold text-white">{{ formatDuration(stats.avgDuration) }}</p>
          <p class="text-[10px] text-white/40">Avg</p>
        </div>
      </div>

      <!-- Weekly chart -->
      <div class="flex items-end gap-1.5 h-16">
        <div
          v-for="(day, i) in stats.weekDays"
          :key="i"
          class="flex-1 flex flex-col items-center gap-0.5"
        >
          <div
            class="w-full rounded-t-sm transition-all"
            :style="{ height: `${day.count * 20 + 4}px`, background: day.count > 0 ? '#4cb782' : '#ffffff08' }"
          ></div>
          <span class="text-[10px] text-white/30">{{ day.label }}</span>
        </div>
      </div>
    </div>

    <!-- Loading / Error / Empty -->
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else-if="sessions.length === 0" class="text-center py-12">
      <p class="text-white/40 text-lg mb-2">No sessions yet</p>
      <p class="text-white/30 text-sm">Complete a workout to see your history here!</p>
    </div>

    <!-- Session list -->
    <div v-else class="space-y-2">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="bg-[#181825] rounded-xl p-4 border border-white/5 cursor-pointer hover:border-[#4cb782]/30 transition-colors"
        @click="openDetail(session)"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-semibold text-sm">{{ session.template_name }}</h3>
            <p class="text-xs text-white/40 mt-0.5">{{ formatDate(session.started_at) }}</p>
          </div>
          <span class="text-xs text-white/30">~{{ Math.round(session.total_kcal_estimated) }} kcal</span>
        </div>
        <div class="flex gap-3 mt-2 text-xs text-white/50">
          <span>{{ formatDuration(session.total_duration_seconds) }}</span>
          <span>{{ session.exercises.length }} exercises</span>
        </div>
      </div>
    </div>

    <!-- Session Detail Modal -->
    <div
      v-if="detailSession"
      class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      @click.self="detailSession = null"
    >
      <div class="bg-[#1e1e2e] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-white/10 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold">{{ detailSession.template_name }}</h2>
          <button @click="detailSession = null" class="text-white/40 hover:text-white/70 text-xl leading-none">&times;</button>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="bg-[#181825] rounded-lg p-3 text-center">
            <p class="text-lg font-bold text-white">{{ formatDuration(detailSession.total_duration_seconds) }}</p>
            <p class="text-[10px] text-white/40">Duration</p>
          </div>
          <div class="bg-[#181825] rounded-lg p-3 text-center">
            <p class="text-lg font-bold text-white">{{ detailSession.exercises.length }}</p>
            <p class="text-[10px] text-white/40">Exercises</p>
          </div>
          <div class="bg-[#181825] rounded-lg p-3 text-center">
            <p class="text-lg font-bold text-[#4cb782]">{{ Math.round(detailSession.total_kcal_estimated) }}</p>
            <p class="text-[10px] text-white/40">Kcal</p>
          </div>
        </div>

        <p class="text-xs text-white/40 mb-3">{{ formatDateFull(detailSession.started_at) }}</p>

        <!-- Exercise list -->
        <div class="space-y-1.5 mb-4">
          <div
            v-for="(ex, i) in detailSession.exercises"
            :key="ex.id"
            class="flex items-center gap-3 bg-[#181825] rounded-lg p-2.5"
          >
            <span class="text-xs text-white/30 w-5 text-right">{{ i + 1 }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ ex.exercise_name }}</p>
              <p class="text-xs text-white/40">{{ ex.duration_seconds }}s</p>
            </div>
            <span class="text-xs text-white/30">{{ Math.round(ex.kcal_burned) }} kcal</span>
          </div>
        </div>

        <p class="text-xs text-white/30 text-center">{{ formatDateRelative(detailSession.started_at) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api'

const props = defineProps({
  refreshKey: { type: Number, default: 0 },
})

const sessions = ref([])
const loading = ref(true)
const error = ref(null)
const detailSession = ref(null)

const stats = computed(() => {
  const items = sessions.value
  const totalSessions = items.length
  const totalMinutes = items.reduce((s, i) => s + Math.round((i.total_duration_seconds || 0) / 60), 0)
  const totalKcal = items.reduce((s, i) => s + (i.total_kcal_estimated || 0), 0)
  const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) * 60 : 0

  // Weekly chart (last 7 days)
  const now = new Date()
  const weekDays = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const count = items.filter(s => {
      const sd = new Date(s.started_at)
      return sd.toISOString().slice(0, 10) === dayStr
    }).length
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    weekDays.push({ label: labels[d.getDay()], count: Math.min(count, 5) })
  }

  return { totalSessions, totalMinutes, totalKcal, avgDuration, weekDays }
})

async function loadSessions() {
  loading.value = true
  error.value = null
  try {
    sessions.value = await api.getSessions()
  } catch (e) {
    error.value = 'Failed to load sessions'
  } finally {
    loading.value = false
  }
}

watch(() => props.refreshKey, loadSessions)
onMounted(loadSessions)

function openDetail(session) {
  detailSession.value = session
}

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHours(minutes) {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateRelative(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>