import { reactive } from 'vue'
import type { Evaluation } from './types'
import { Api, useAuthToken } from './api/client'
import { seed } from './fixtures/demo'
import { i18n } from './i18n'

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}
const DEBOUNCE_MS = 120
const $t = (k: string) => (i18n.global as any).t(k) as string

const state = reactive({
  token: '' as string,
  user: null as null | { email: string; roles: string[] },

  evaluations: [] as Evaluation[],
  teams: ['Team 1', 'Team 2', 'Team 3'] as string[],
  toasts: [] as { id: string; text: string }[],
  loading: false,
  error: '' as string,

  // aggregates cache/versioning
  evalVersion: 0,
  lastAggVersion: -1,
  aggregatesCache: null as any,
  aggregatesLoading: false,
  aggregatesError: '' as string,
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inflightAgg: Promise<any> | null = null

// --- simple queue for guest actions (sent after login) ---
type Task = () => Promise<void>
const requestQueue: Task[] = []
let flushing = false
const isLoggedIn = () => !!state.user && !!state.user.email

async function flushQueue() {
  if (flushing || requestQueue.length === 0) return
  flushing = true
  while (requestQueue.length) {
    const t = requestQueue.shift()!
    try {
      await t()
    } catch (e) {
      console.warn('queued request failed', e)
    }
  }
  flushing = false
}
function queueOrRun(task: Task): Promise<void> {
  if (!isLoggedIn()) {
    return new Promise<void>((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          await task()
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  }
  return task()
}
// ------------------------------------------------------------------

// wire token plumbing for Api interceptors
useAuthToken(
  () => state.token,
  (t) => (state.token = t),
)

export const useStore = () => {
  /** allow router to set user after /me */
  function setUser(u: { email: string; roles: string[] } | null) {
    state.user = u
  }

  /** Boot once: try session (/me) first, then choose data source */
  async function init() {
    state.loading = true
    try {
      // Try to recover session (interceptor will POST /auth/refresh on 401)
      if (!state.user) {
        try {
          const me = await Api.me()
          state.user = me
        } catch {
          // stay guest
        }
      }

      if (isLoggedIn()) {
        const fromApi = await Api.listEvaluations()
        state.evaluations =
          Array.isArray(fromApi) && fromApi.length ? fromApi : [...seed]
        state.evalVersion++
        await fetchAggregates()
      } else {
        state.evaluations = [...seed]
        state.evalVersion++
      }
    } finally {
      state.loading = false
    }
  }

  // ----- Auth -----
  async function login(email: string, password: string) {
    await Api.login(email, password)
    state.user = await Api.me()
    toast($t('toast.signedin'))
    await flushQueue()
    await refreshFromServer()
  }

  async function refreshFromServer() {
    try {
      if (!isLoggedIn()) return
      const fromApi = await Api.listEvaluations()
      if (Array.isArray(fromApi)) {
        state.evaluations = fromApi
        state.evalVersion++
      }
      await fetchAggregates()
    } catch (e) {
      console.warn('refreshFromServer failed', e)
    }
  }

  async function register(email: string, password: string) {
    await Api.register(email, password)
    toast($t('auth.check_mail'))
  }

  async function logout() {
    await Api.logout()
    state.user = null
    toast($t('toast.signedout'))
    state.evaluations = [...seed]
    state.evalVersion++
    state.aggregatesCache = null
    state.lastAggVersion = -1
  }

  // --- Passwort zurücksetzen ---
  async function resetPassword(email: string) {
    await Api.resetPassword(email)
    toast($t('auth.reset_sent'))
  }

  function setToken(t: string) {
    state.token = t
  }

  // ----- UI helpers -----
  function toast(text: string) {
    const id = uuid()
    state.toasts.push({ id, text })
    setTimeout(() => dismiss(id), 2500)
  }
  function dismiss(id: string) {
    state.toasts = state.toasts.filter((t) => t.id !== id)
  }

  // ----- CRUD (optimistic + queued) -----
  function addEvaluation(
    input: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const now = new Date().toISOString()
    const e: Evaluation = {
      id: uuid(),
      createdAt: now,
      updatedAt: now,
      ...input,
    }
    state.evaluations.unshift(e)
    state.evalVersion++
    toast($t('toast.saved'))
    scheduleFetchAggregates()
    void queueOrRun(async () => {
      await Api.createEvaluation(e)
    })
  }

  function updateEvaluation(id: string, patch: Partial<Evaluation>) {
    const idx = state.evaluations.findIndex((e) => e.id === id)
    if (idx < 0) return
    state.evaluations[idx] = {
      ...state.evaluations[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    state.evalVersion++
    toast($t('toast.updated'))
    scheduleFetchAggregates()
    void queueOrRun(async () => {
      await Api.updateEvaluation(id, patch)
    })
  }

  function deleteEvaluation(id: string) {
    state.evaluations = state.evaluations.filter((e) => e.id !== id)
    state.evalVersion++
    toast($t('toast.deleted'))
    scheduleFetchAggregates()
    void queueOrRun(async () => {
      await Api.deleteEvaluation(id)
    })
  }

  // ----- Aggregates (only when logged in; no polling) -----
  function scheduleFetchAggregates() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void fetchAggregates()
    }, DEBOUNCE_MS)
  }

  async function fetchAggregates() {
    if (!isLoggedIn()) return
    if (state.lastAggVersion === state.evalVersion && state.aggregatesCache)
      return state.aggregatesCache
    if (inflightAgg) return inflightAgg

    state.aggregatesLoading = true
    state.aggregatesError = ''

    inflightAgg = (async () => {
      try {
        const data = await Api.getAggregatedResults()
        state.aggregatesCache = data
        state.lastAggVersion = state.evalVersion
        return data
      } catch (e: any) {
        state.aggregatesError = e?.message || String(e)
        throw e
      } finally {
        state.aggregatesLoading = false
        inflightAgg = null
      }
    })()

    return inflightAgg
  }

  return {
    state,
    // auth
    setUser,
    login,
    register,
    logout,
    setToken,
    resetPassword, // <--- HIER hinzugefügt
    // data
    init,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    fetchAggregates,
    refreshFromServer,
    // ui
    toast,
    dismiss,
  }
}
