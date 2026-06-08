import axios, { AxiosInstance, AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// Auth token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const apiKey = localStorage.getItem('api_key')
  if (apiKey && !token) config.headers['X-API-Key'] = apiKey
  return config
})

// Auto token refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const orig = error.config as any
    if (error.response?.status === 401 && !orig._retry) {
      orig._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          orig.headers.Authorization = `Bearer ${data.access_token}`
          return api(orig)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (d: { email: string; username: string; display_name: string; password: string }) =>
    api.post('/auth/register', d).then(r => r.data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  verifyEmail: (token: string) =>
    api.post('/auth/verify-email', { token }).then(r => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }).then(r => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }).then(r => r.data),
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  updateProfile: (d: any) => api.put('/users/me', d).then(r => r.data),
  getPublicProfile: (username: string) => api.get(`/users/${username}/public`).then(r => r.data),
  getActivityFeed: (page = 1) => api.get('/users/feed/activity', { params: { page } }).then(r => r.data),
  toggleFollow: (userId: string) => api.post(`/users/${userId}/follow`).then(r => r.data),
}

// ─── Voices ──────────────────────────────────────────────────────────────────
export const voicesApi = {
  list: (params?: any) => api.get('/voices', { params }).then(r => r.data),
  get: (id: string) => api.get(`/voices/${id}`).then(r => r.data),
  create: (d: any) => api.post('/voices', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/voices/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/voices/${id}`).then(r => r.data),
  toggleLike: (id: string) => api.post(`/voices/${id}/like`).then(r => r.data),
  addComment: (id: string, content: string) =>
    api.post(`/voices/${id}/comments`, null, { params: { content } }).then(r => r.data),
  getComments: (id: string) => api.get(`/voices/${id}/comments`).then(r => r.data),
}

// ─── Cloning ─────────────────────────────────────────────────────────────────
export const cloningApi = {
  startJob: (d: { voice_profile_id: string; mode: string; fine_tune_steps?: number }) =>
    api.post('/cloning/start', d).then(r => r.data),
  getJob: (id: string) => api.get(`/cloning/${id}`).then(r => r.data),
  listJobs: (params?: any) => api.get('/cloning', { params }).then(r => r.data),
  uploadSample: (voiceProfileId: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/cloning/upload-sample/${voiceProfileId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    }).then(r => r.data)
  },
}

// ─── Generation ──────────────────────────────────────────────────────────────
export const generationApi = {
  generate: (d: any) => api.post('/generation', d).then(r => r.data),
  getJob: (id: string) => api.get(`/generation/${id}`).then(r => r.data),
  list: (params?: any) => api.get('/generation', { params }).then(r => r.data),
}

// ─── Detection ───────────────────────────────────────────────────────────────
export const detectionApi = {
  analyze: (file: File, params?: { confidence_threshold?: number; enable_diarization?: boolean },
            onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/detection/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    }).then(r => r.data)
  },
  getJob: (id: string) => api.get(`/detection/${id}`).then(r => r.data),
  list: (params?: any) => api.get('/detection', { params }).then(r => r.data),
  updateNotes: (id: string, notes: string) =>
    api.patch(`/detection/${id}/notes`, null, { params: { notes } }).then(r => r.data),
  getEvidence: (id: string) => api.get(`/detection/${id}/evidence`).then(r => r.data),
  exportJson: (id: string) =>
    api.get(`/detection/${id}/export/json`, { responseType: 'blob' }).then(r => r.data),
  delete: (id: string) => api.delete(`/detection/${id}`).then(r => r.data),
  stats: () => api.get('/detection/stats/summary').then(r => r.data),
}

// ─── Hub ─────────────────────────────────────────────────────────────────────
export const hubApi = {
  listVoices: (params?: any) => api.get('/hub/voices', { params }).then(r => r.data),
  getVoice: (id: string) => api.get(`/hub/voices/${id}`).then(r => r.data),
  featured: () => api.get('/hub/featured').then(r => r.data),
  stats: () => api.get('/hub/stats').then(r => r.data),
}

// ─── Plans ───────────────────────────────────────────────────────────────────
export const plansApi = {
  list: () => api.get('/plans').then(r => r.data),
  current: () => api.get('/plans/current').then(r => r.data),
  upgrade: (tier: string, billing_cycle = 'monthly') =>
    api.post('/plans/upgrade', null, { params: { tier, billing_cycle } }).then(r => r.data),
}

// ─── API Keys ────────────────────────────────────────────────────────────────
export const apiKeysApi = {
  list: () => api.get('/api-keys').then(r => r.data),
  create: (name: string, scopes?: string[]) =>
    api.post('/api-keys', null, { params: { name, scopes: scopes?.join(',') } }).then(r => r.data),
  revoke: (id: string) => api.delete(`/api-keys/${id}`).then(r => r.data),
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get('/analytics/overview').then(r => r.data),
  timeline: (days = 30) => api.get('/analytics/timeline', { params: { days } }).then(r => r.data),
}

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }).then(r => r.data),
  markRead: (id: string) => api.post(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.post('/notifications/read-all').then(r => r.data),
}

// ─── History ─────────────────────────────────────────────────────────────────
export const historyApi = {
  list: (params?: any) => api.get('/history', { params }).then(r => r.data),
}

// ─── Audit ───────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }).then(r => r.data),
}

// ─── Quality ─────────────────────────────────────────────────────────────────
export const qualityApi = {
  analyze: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/quality/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────
export const benchmarksApi = {
  models: () => api.get('/benchmarks/models').then(r => r.data),
  system: () => api.get('/benchmarks/system').then(r => r.data),
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats').then(r => r.data),
  listUsers: (params?: any) => api.get('/admin/users', { params }).then(r => r.data),
  changeUserPlan: (userId: string, tier: string) =>
    api.patch(`/admin/users/${userId}/plan`, null, { params: { tier } }).then(r => r.data),
}

// ─── Orgs ────────────────────────────────────────────────────────────────────
export const orgsApi = {
  create: (name: string, slug: string) =>
    api.post('/organizations', null, { params: { name, slug } }).then(r => r.data),
  myOrgs: () => api.get('/organizations/me').then(r => r.data),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (Array.isArray(detail) && detail.length > 0) {
      // Handle Pydantic validation errors
      return detail.map((e: any) => e.msg || String(e)).join(', ')
    }
    if (typeof detail === 'string') {
      return detail
    }
    return err.response?.data?.message || err.message
  }
  return String(err)
}

export default api
