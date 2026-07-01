<template>
  <div class="exercises-tab">
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else>
      <!-- Search -->
      <input
        v-model="search"
        type="text"
        placeholder="Search exercises..."
        class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50 mb-4"
        @input="onSearch"
      />

      <!-- Exercise List -->
      <div v-if="filtered.length === 0" class="text-center py-8 text-white/30">
        No exercises found
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="ex in filtered"
          :key="ex.id"
          class="bg-[#181825] rounded-xl p-3 border border-white/5"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium">{{ ex.name }}</h3>
            <span :class="categoryBadge(ex.category)" class="text-xs px-2 py-0.5 rounded-full">{{ ex.category }}</span>
          </div>
          <div class="flex gap-3 mt-1.5 text-xs text-white/40">
            <span>{{ ex.default_duration_seconds }}s default</span>
            <span>~{{ ex.default_kcal_per_min }} kcal/min</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { api } from '../api'
import { onMounted } from 'vue'

const exercises = ref([])
const filtered = ref([])
const search = ref('')
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    exercises.value = await api.getExercises()
    filtered.value = exercises.value
  } catch (e) {
    error.value = 'Failed to load exercises'
  } finally {
    loading.value = false
  }
})

function onSearch() {
  if (!search.value) {
    filtered.value = exercises.value
    return
  }
  const q = search.value.toLowerCase()
  filtered.value = exercises.value.filter(e => e.name.toLowerCase().includes(q))
}

function categoryBadge(cat) {
  const colors = {
    cardio: 'bg-green-900/40 text-green-300',
    strength: 'bg-blue-900/40 text-blue-300',
    flexibility: 'bg-purple-900/40 text-purple-300',
    other: 'bg-gray-800/40 text-gray-300',
  }
  return colors[cat] || colors.other
}
</script>