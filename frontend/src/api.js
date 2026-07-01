const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000'

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Exercises
  getExercises: (search) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    return fetchJSON(`/api/v1/exercises${params}`)
  },
  getExercise: (id) => fetchJSON(`/api/v1/exercises/${id}`),
  createExercise: (data) => fetchJSON('/api/v1/exercises', { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id, data) => fetchJSON(`/api/v1/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExercise: (id) => fetchJSON(`/api/v1/exercises/${id}`, { method: 'DELETE' }),

  // Workouts
  getWorkouts: () => fetchJSON('/api/v1/workouts'),
  getWorkout: (id) => fetchJSON(`/api/v1/workouts/${id}`),
  createWorkout: (data) => fetchJSON('/api/v1/workouts', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkout: (id, data) => fetchJSON(`/api/v1/workouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkout: (id) => fetchJSON(`/api/v1/workouts/${id}`, { method: 'DELETE' }),

  // Sessions
  getSessions: () => fetchJSON('/api/v1/sessions'),
  getSession: (id) => fetchJSON(`/api/v1/sessions/${id}`),
  createSession: (data) => fetchJSON('/api/v1/sessions', { method: 'POST', body: JSON.stringify(data) }),
  endSession: (id, data) => fetchJSON(`/api/v1/sessions/${id}/end`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => fetchJSON(`/api/v1/sessions/${id}`, { method: 'DELETE' }),
}