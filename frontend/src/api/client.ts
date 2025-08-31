// frontend/src/api/client.ts
import axios, { AxiosError } from 'axios'
import type { Evaluation, TeamAggregate } from '../types'
import type { AxiosRequestConfig } from 'axios'

const apiBase = (import.meta.env.VITE_API_BASE as string) ?? '/api'

// --- in-memory token plumbing (vom Store gesetzt) ---
let getToken: () => string = () => ''
let setToken: (t: string) => void = () => {}

export function useAuthToken(
  getter: () => string,
  setter: (t: string) => void,
) {
  getToken = getter
  setToken = setter
}

// --- axios instance ---
export const http = axios.create({
  baseURL: apiBase,
  withCredentials: true, // sendet Refresh-Cookie für /auth/refresh
  headers: { 'Content-Type': 'application/json' },
})

// --- request: Authorization anhängen ---
http.interceptors.request.use((cfg) => {
  const token = getToken()
  if (token && cfg.headers) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// --- response: 401 -> einmalig refreshen + retry der Original-Request ---
let isRefreshing = false
let pending: Array<(t: string) => void> = []

async function refreshAccessToken(): Promise<string> {
  const { data } = await http.post<{ accessToken: string }>('/auth/refresh')
  setToken(data.accessToken)
  return data.accessToken
}

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const resp = error.response
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined

    // kein Retry bei fehlender Response, bei Login/Register/Refresh selbst oder wenn schon versucht
    const url = (original?.url ?? '').toString()
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh')
    if (
      !resp ||
      resp.status !== 401 ||
      isAuthEndpoint ||
      !original ||
      original._retry
    ) {
      return Promise.reject(error)
    }

    original._retry = true

    if (!isRefreshing) {
      isRefreshing = true
      try {
        const newTok = await refreshAccessToken()
        pending.forEach((cb) => cb(newTok))
        pending = []
      } catch (e) {
        pending = []
        setToken('') // Session ist wirklich weg
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }

    return new Promise((resolve) => {
      pending.push((tok) => {
        if (!original.headers) original.headers = {}
        ;(original.headers as any).Authorization = `Bearer ${tok}`
        resolve(http(original))
      })
    })
  },
)

// ------- Public API -------
export const Api = {
  // Auth
  async register(email: string, password: string): Promise<void> {
    await http.post('/auth/register', { email, password })
  },
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const { data } = await http.post<{ accessToken: string }>('/auth/login', {
      email,
      password,
    })
    setToken(data.accessToken)
    return data
  },
  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout')
    } finally {
      setToken('')
    }
  },
  async me(): Promise<{ email: string; roles: string[] }> {
    const { data } = await http.get('/me')
    return data
  },

  // Evaluations
  async listEvaluations(): Promise<Evaluation[]> {
    const { data } = await http.get<Evaluation[]>('/evaluations')
    return data
  },
  async createEvaluation(e: Evaluation) {
    return http.post('/evaluations', e)
  },
  async updateEvaluation(id: String, patch: Partial<Evaluation>) {
    return http.put(`/evaluations/${id}`, patch)
  },
  async deleteEvaluation(id: String) {
    return http.delete(`/evaluations/${id}`)
  },

  // Aggregates
  async getAggregatedResults(): Promise<TeamAggregate[]> {
    const { data } = await http.get<TeamAggregate[]>('/aggregates')
    return data
  },
}
