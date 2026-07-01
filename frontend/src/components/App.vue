<template>
  <div class="app-shell flex flex-col h-screen">
    <!-- Header -->
    <header class="px-4 py-3 flex items-center justify-between border-b border-white/10">
      <h1 class="text-lg font-bold">{{ currentTab === 'workout' ? 'Workout' : currentTab === 'exercises' ? 'Exercises' : 'History' }}</h1>
      <span class="text-xs text-white/40">FitnessTracker</span>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto px-4 py-4">
      <WorkoutTab v-if="currentTab === 'workout'" />
      <ExercisesTab v-else-if="currentTab === 'exercises'" />
      <HistoryTab v-else-if="currentTab === 'history'" />
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav flex items-center justify-around border-t border-white/10 bg-[#181825] px-2 py-2">
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
import { ref } from 'vue'
import WorkoutTab from './WorkoutTab.vue'
import ExercisesTab from './ExercisesTab.vue'
import HistoryTab from './HistoryTab.vue'

const currentTab = ref('workout')

const tabs = [
  { id: 'workout', label: 'Workout', icon: '&#x1F3CB;' },
  { id: 'exercises', label: 'Exercises', icon: '&#x1F4AA;' },
  { id: 'history', label: 'History', icon: '&#x1F4CA;' },
]
</script>