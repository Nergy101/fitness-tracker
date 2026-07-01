<template>
  <div class="exercises-tab">
    <!-- Header with add button -->
    <div class="flex items-center justify-between mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search exercises..."
        class="flex-1 bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50"
        @input="onSearch"
      />
      <button
        @click="openCreate"
        class="ml-3 bg-[#4cb782] text-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#5dd495] transition-colors whitespace-nowrap"
      >
        + Add
      </button>
    </div>

    <!-- Exercise List -->
    <div v-if="loading" class="text-center py-8 text-white/40">Loading...</div>
    <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="text-center py-12 text-white/30">
      <p class="text-lg mb-1">No exercises found</p>
      <p class="text-sm text-white/20">Try a different search or add one!</p>
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="ex in filtered"
        :key="ex.id"
        class="bg-[#181825] rounded-xl p-3 border border-white/5 cursor-pointer hover:border-[#4cb782]/30 transition-colors"
        @click="openEdit(ex)"
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

    <!-- Create/Edit Modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      @click.self="closeForm"
    >
      <div class="bg-[#1e1e2e] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-white/10 max-h-[85vh] overflow-y-auto">
        <h2 class="text-lg font-bold mb-4">{{ editing ? 'Edit Exercise' : 'New Exercise' }}</h2>

        <div class="space-y-4">
          <!-- Name -->
          <div>
            <label class="text-sm text-white/60 block mb-1">Name *</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Burpees"
              class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50"
            />
            <p v-if="errors.name" class="text-red-400 text-xs mt-1">{{ errors.name }}</p>
          </div>

          <!-- Description -->
          <div>
            <label class="text-sm text-white/60 block mb-1">Description</label>
            <textarea
              v-model="form.description"
              placeholder="Optional description..."
              rows="2"
              class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50 resize-none"
            ></textarea>
          </div>

          <!-- Category -->
          <div>
            <label class="text-sm text-white/60 block mb-1">Category</label>
            <select
              v-model="form.category"
              class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50"
            >
              <option value="cardio">Cardio</option>
              <option value="strength">Strength</option>
              <option value="flexibility">Flexibility</option>
              <option value="other">Other</option>
            </select>
          </div>

          <!-- Duration -->
          <div>
            <label class="text-sm text-white/60 block mb-1">Default Duration (seconds)</label>
            <input
              v-model.number="form.default_duration_seconds"
              type="number"
              min="5"
              max="300"
              class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50"
            />
          </div>

          <!-- Kcal per min -->
          <div>
            <label class="text-sm text-white/60 block mb-1">Kcal per Minute</label>
            <input
              v-model.number="form.default_kcal_per_min"
              type="number"
              min="0"
              max="50"
              step="0.5"
              class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50"
            />
          </div>

          <!-- Buttons -->
          <div class="flex gap-3 pt-2">
            <button
              @click="closeForm"
              class="flex-1 bg-white/10 rounded-xl py-2.5 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="saveExercise"
              :disabled="saving"
              class="flex-1 bg-[#4cb782] text-[#1e1e2e] rounded-xl py-2.5 text-sm font-semibold hover:bg-[#5dd495] transition-colors disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : (editing ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const exercises = ref([])
const search = ref('')
const loading = ref(true)
const error = ref(null)
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const errors = ref({})

const form = ref({
  name: '',
  description: '',
  category: 'other',
  default_duration_seconds: 30,
  default_kcal_per_min: 5.0,
})

const filtered = computed(() => {
  if (!search.value) return exercises.value
  const q = search.value.toLowerCase()
  return exercises.value.filter(e => e.name.toLowerCase().includes(q))
})

onMounted(loadExercises)

async function loadExercises() {
  try {
    exercises.value = await api.getExercises()
    error.value = null
  } catch (e) {
    error.value = 'Failed to load exercises'
  } finally {
    loading.value = false
  }
}

function onSearch() {
  // Computed handles filtering
}

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '', category: 'other', default_duration_seconds: 30, default_kcal_per_min: 5.0 }
  errors.value = {}
  showForm.value = true
}

function openEdit(ex) {
  editing.value = ex.id
  form.value = {
    name: ex.name,
    description: ex.description || '',
    category: ex.category,
    default_duration_seconds: ex.default_duration_seconds,
    default_kcal_per_min: ex.default_kcal_per_min,
  }
  errors.value = {}
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
}

async function saveExercise() {
  errors.value = {}
  if (!form.value.name.trim()) {
    errors.value.name = 'Name is required'
    return
  }

  saving.value = true
  try {
    if (editing.value) {
      await api.updateExercise(editing.value, form.value)
    } else {
      await api.createExercise(form.value)
    }
    closeForm()
    await loadExercises()
  } catch (e) {
    errors.value._api = e.message
  } finally {
    saving.value = false
  }
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