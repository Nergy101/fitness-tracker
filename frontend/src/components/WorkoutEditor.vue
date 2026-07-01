<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" @click.self="$emit('close')">
    <div class="bg-[#1e1e2e] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 border border-white/10 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">{{ isEditing ? workout.name : 'New Workout' }}</h2>
        <button @click="$emit('close')" class="text-white/40 hover:text-white/70 text-xl leading-none">&times;</button>
      </div>

      <!-- Name field -->
      <input
        v-model="form.name"
        type="text"
        placeholder="Workout name..."
        class="w-full bg-[#181825] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#4cb782]/50 mb-4"
      />

      <!-- Add exercises button -->
      <button
        @click="showPicker = !showPicker"
        class="flex items-center gap-2 text-sm text-[#4cb782] mb-3 hover:text-[#5dd495] transition-colors"
      >
        <span class="text-lg leading-none">+</span> Add Exercise
      </button>

      <!-- Exercise picker -->
      <div v-if="showPicker" class="bg-[#181825] rounded-xl border border-white/10 p-2 mb-3 max-h-40 overflow-y-auto">
        <input
          v-model="pickerSearch"
          type="text"
          placeholder="Search exercises..."
          class="w-full bg-[#1e1e2e] border border-white/5 rounded-lg px-3 py-1.5 text-xs outline-none mb-2"
        />
        <div
          v-for="ex in filteredExercises"
          :key="ex.id"
          class="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer text-sm"
          @click="addExercise(ex)"
        >
          <span>{{ ex.name }}</span>
          <span class="text-xs text-white/40">{{ ex.default_duration_seconds }}s</span>
        </div>
        <div v-if="filteredExercises.length === 0" class="text-xs text-white/30 text-center py-2">No exercises match</div>
      </div>

      <!-- Exercise list in template -->
      <div class="flex-1 overflow-y-auto space-y-1.5 mb-4 min-h-0">
        <div v-if="form.exercises.length === 0" class="text-center py-8 text-white/20 text-sm">
          Add exercises to build your workout
        </div>
        <div
          v-for="(item, i) in form.exercises"
          :key="item._key"
          class="bg-[#181825] rounded-xl px-3 py-2 flex items-center gap-2 border border-white/5"
        >
          <!-- Move up -->
          <button @click="moveUp(i)" :disabled="i === 0" class="text-white/20 hover:text-white/60 disabled:opacity-20 p-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <!-- Move down -->
          <button @click="moveDown(i)" :disabled="i === form.exercises.length - 1" class="text-white/20 hover:text-white/60 disabled:opacity-20 p-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ item.exercise_name }}</div>
            <div class="flex items-center gap-2">
              <input
                v-model.number="item.duration_seconds"
                type="number"
                min="5"
                max="600"
                class="w-16 bg-[#1e1e2e] border border-white/10 rounded-lg px-2 py-0.5 text-xs outline-none"
              />
              <span class="text-xs text-white/40">s</span>
            </div>
          </div>

          <!-- Remove -->
          <button @click="form.exercises.splice(i, 1)" class="text-red-400/50 hover:text-red-400 p-0.5" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <!-- Summary + Save -->
      <div class="border-t border-white/10 pt-3 flex items-center justify-between">
        <div class="text-xs text-white/40">
          <span>{{ form.exercises.length }} exercises · </span>
          <span>{{ formatDuration(totalDuration) }}</span>
        </div>
        <div class="flex gap-2">
          <button @click="$emit('close')" class="px-4 py-2 text-sm text-white/50 hover:text-white/80">Cancel</button>
          <button
            @click="save"
            :disabled="saving || !form.name.trim()"
            class="bg-[#4cb782] text-[#1e1e2e] rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#5dd495] transition-colors disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api'

const props = defineProps({
  workout: { type: Object, default: null },
  exercises: { type: Array, default: () => [] },
})
const emit = defineEmits(['save', 'close'])

const isEditing = computed(() => props.workout && props.workout.id)

const form = ref({
  name: '',
  exercises: [],
})

const showPicker = ref(false)
const pickerSearch = ref('')
const saving = ref(false)
let keyCounter = 0

const filteredExercises = computed(() => {
  const existingIds = new Set(form.value.exercises.map(e => e.exercise_id))
  let list = props.exercises.filter(e => !existingIds.has(e.id))
  if (pickerSearch.value) {
    const q = pickerSearch.value.toLowerCase()
    list = list.filter(e => e.name.toLowerCase().includes(q))
  }
  return list
})

const totalDuration = computed(() => {
  return form.value.exercises.reduce((sum, e) => sum + (e.duration_seconds || 30), 0)
})

// Initialize form from workout prop
watch(() => props.workout, (w) => {
  if (w) {
    form.value = {
      name: w.name || '',
      exercises: (w.exercises || []).map((e, i) => ({
        _key: keyCounter++,
        exercise_id: e.exercise?.id || e.exercise_id,
        exercise_name: e.exercise?.name || e.exercise_name || '',
        duration_seconds: e.duration_seconds || 30,
      })),
    }
  } else {
    form.value = { name: '', exercises: [] }
  }
}, { immediate: true })

function addExercise(ex) {
  form.value.exercises.push({
    _key: keyCounter++,
    exercise_id: ex.id,
    exercise_name: ex.name,
    duration_seconds: ex.default_duration_seconds || 30,
  })
  showPicker.value = false
  pickerSearch.value = ''
}

function moveUp(i) {
  if (i === 0) return
  const arr = form.value.exercises
  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
}

function moveDown(i) {
  if (i === form.value.exercises.length - 1) return
  const arr = form.value.exercises
  ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
}

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      description: props.workout?.description || '',
      exercises: form.value.exercises.map((e, i) => ({
        exercise_id: e.exercise_id,
        duration_seconds: e.duration_seconds || 30,
        order_index: i,
      })),
    }

    if (isEditing.value) {
      await api.updateWorkout(props.workout.id, payload)
    } else {
      await api.createWorkout(payload)
    }
    emit('save')
  } catch (e) {
    console.error('Save failed', e)
    alert('Failed to save workout')
  } finally {
    saving.value = false
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
</script>