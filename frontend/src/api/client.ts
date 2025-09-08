import axios, { AxiosError } from 'axios'
import type { Evaluation, TeamAggregate } from '../types'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

const apiBase = (import.meta.env.VITE_API_BASE as string) ?? '/api'

// token wiring (provided by store)
let getToken: () => string = () => ''
let setToken: (t: string) => void = () => {}
export function useAuthToken(
  getter: () => string,
  setter: (t: string) => void,
) {
  getToken = getter
  setToken = setter
}

// axios
export const http = axios.create({
  baseURL: apiBase,
  withCredentials: true, // needed for cookie-based refresh
  headers: { 'Content-Type': 'application/json' },
})

// request: attach Authorization
http.interceptors.request.use((config) => {
  const token = getToken()
  if (!config.headers) config.headers = new (axios.AxiosHeaders as any)()
  if (token) (config.headers as any).Authorization = `Bearer ${token}`
  else delete (config.headers as any).Authorization
  return config
})

// refresh pipeline
let isRefreshing = false
type Waiter = { onToken: (tok: string) => void; onError: (err: any) => void }
let pending: Waiter[] = []

async function refreshAccessToken(): Promise<string> {
  const { data } = await http.post<{ accessToken: string }>('/auth/refresh')
  setToken(data.accessToken)
  http.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`
  return data.accessToken
}

// response: on 401 -> refresh once and retry
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const resp = error.response
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined
    const url = (original?.url ?? '').toString()
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh')

    if (
      !resp ||
      resp.status !== 401 ||
      !original ||
      isAuthEndpoint ||
      original._retry
    ) {
      return Promise.reject(error)
    }

    original._retry = true

    if (!isRefreshing) {
      isRefreshing = true
      try {
        const newTok = await refreshAccessToken()
        if (!original.headers) original.headers = {}
        ;(original.headers as any).Authorization = `Bearer ${newTok}`
        const retryResponse: AxiosResponse = await http(original)
        pending.forEach((w) => w.onToken(newTok))
        pending = []
        return retryResponse
      } catch (e) {
        pending.forEach((w) => w.onError(e))
        pending = []
        setToken('')
        delete http.defaults.headers.common.Authorization
        throw e
      } finally {
        isRefreshing = false
      }
    }

    return new Promise((resolve, reject) => {
      pending.push({
        onToken: (tok) => {
          if (!original.headers) original.headers = {}
          ;(original.headers as any).Authorization = `Bearer ${tok}`
          http(original).then(resolve).catch(reject)
        },
        onError: (err) => reject(err),
      })
    })
  },
)

// Public API
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
    http.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`
    return data
  },
  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout')
    } finally {
      setToken('')
      delete http.defaults.headers.common.Authorization
    }
  },
  async me(): Promise<{ email: string; roles: string[] }> {
    const { data } = await http.get('/me')
    return data
  },
  async resetPassword(email: string): Promise<void> {
    await http.post('/auth/reset', { email })
  },

  // Evaluations
  async listEvaluations(): Promise<Evaluation[]> {
    const { data } = await http.get<Evaluation[]>('/evaluations')
    return data
  },
  async createEvaluation(e: Evaluation) {
    return http.post('/evaluations', e)
  },
  async updateEvaluation(id: string, patch: Partial<Evaluation>) {
    return http.put(`/evaluations/${id}`, patch)
  },
  async deleteEvaluation(id: string) {
    return http.delete(`/evaluations/${id}`)
  },

  // Aggregates
  async getAggregatedResults(): Promise<TeamAggregate[]> {
    const { data } = await http.get<TeamAggregate[]>('/aggregates')
    return data
  },
}
