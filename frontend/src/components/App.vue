<template>
  <div v-if="activeScreen === 'runner'" class="fixed inset-0 z-50">
    <WorkoutRunner :workout="currentWorkout" @finish="onWorkoutFinish" @cancel="activeScreen = 'tabs'" />
  </div>
  <div v-else class="app-shell flex flex-col h-screen">
    <!-- Header -->
    <header class="px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
      <h1 class="text-lg font-bold">{{ tabTitle }}</h1>
      <span class="text-xs text-white/40">FitnessTracker</span>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto px-4 py-4">
      <WorkoutTab
        v-if="currentTab === 'workout'"
        @start-workout="startWorkout"
      />
      <ExercisesTab v-else-if="currentTab === 'exercises'" />
      <HistoryTab v-else-if="currentTab === 'history'" :refresh-key="historyRefreshKey" />
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav flex items-center justify-around border-t border-white/10 bg-[#181825] px-2 py-2 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="[
          'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors',
          currentTab === tab.id ? 'text-[#4cb782]' : 'text-white/40'
        ]"
      >
        <span class="text-xl" v-html="tab.icon"></span>
        <span class="text-xs font-medium">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import WorkoutTab from './WorkoutTab.vue'
import WorkoutRunner from './WorkoutRunner.vue'
import ExercisesTab from './ExercisesTab.vue'
import HistoryTab from './HistoryTab.vue'

const currentTab = ref('workout')
const activeScreen = ref('tabs')
const currentWorkout = ref(null)
const historyRefreshKey = ref(0)

const tabs = [
  { id: 'workout', label: 'Workout', icon: '&#x1F3CB;' },
  { id: 'exercises', label: 'Exercises', icon: '&#x1F4AA;' },
  { id: 'history', label: 'History', icon: '&#x1F4CA;' },
]

const tabTitle = computed(() => {
  const t = tabs.find(t => t.id === currentTab.value)
  return t ? t.label : ''
})

function startWorkout(workout) {
  currentWorkout.value = workout
  activeScreen.value = 'runner'
}

function onWorkoutFinish() {
  activeScreen.value = 'tabs'
  currentWorkout.value = null
  historyRefreshKey.value++
}
</script>