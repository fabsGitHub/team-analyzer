import type {
  SurveyDto,
  SubmitSurveyRequest,
  SurveyResultsDto,
  CreateSurveyRequest,
  TeamLite,
  TeamAdminDto,
  MyOpenToken,
} from '@/types'
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

// ---- Axios-Config erweitern (zusätzliche Flags) ----
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 401 ok, kein Refresh-/Retry-Versuch (z.B. /me auf öffentlicher Seite) */
    allowAnonymous?: boolean
    /** Für diesen Request keinen Authorization-Bearer anhängen */
    skipAuthHeader?: boolean
    /** Älteren Request derselben Gruppe abbrechen (z.B. "survey") */
    cancelGroup?: string
    /** Anzahl Auto-Retries bei transienten Fehlern (nur GET) */
    retry?: number
    /** Per-Request Timeout in ms */
    timeoutMs?: number
    /** intern: wurde schon refresh-retried */
    _retry?: boolean
    /** intern: Zähler für Auto-Retries */
    _retryCount?: number
  }
}

// ---- Cancel-Gruppen + Retry-Utils ----
const inflightByGroup = new Map<string, AbortController>()

function transientStatus(s?: number) {
  return s === 0 || s === 502 || s === 503 || s === 504
}
function jitter(base: number, attempt: number) {
  // 150ms, 300ms, 600ms + jitter
  const delay = base * Math.pow(2, attempt)
  return delay + Math.floor(Math.random() * 100)
}
export function abortGroup(group: string) {
  inflightByGroup.get(group)?.abort('manual abort')
  inflightByGroup.delete(group)
}

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
  // optional global fallback:
  // timeout: 15000,
})

// -- helpers
function setAuthHeader(headers: any, token: string | undefined) {
  const h = headers ?? {}
  if (token) h['Authorization'] = `Bearer ${token}`
  else delete h['Authorization']
  return h
}
function isAuthEndpoint(url?: string | null): boolean {
  const u = (url ?? '').toString()
  return (
    u.includes('/auth/login') ||
    u.includes('/auth/register') ||
    u.includes('/auth/refresh') ||
    u.includes('/auth/logout')
  )
}

// ---- REQUEST: Auth + Cancel-Group + Per-Request Timeout ----
http.interceptors.request.use((config) => {
  // Beim Refresh/Login/etc. keine alte Authorization anhängen.
  if (!isAuthEndpoint(config.url) && !config.skipAuthHeader) {
    const token = getToken()
    config.headers = setAuthHeader(config.headers, token)
  }

  // Cancel-Group: vorherigen laufenden Request abbrechen
  let controller: AbortController | undefined
  if (config.cancelGroup) {
    inflightByGroup.get(config.cancelGroup)?.abort('newer request')
    controller = new AbortController()
    inflightByGroup.set(config.cancelGroup, controller)
  }

  // Per-Request Timeout
  if (config.timeoutMs) {
    controller = controller ?? new AbortController()
    setTimeout(() => controller?.abort('timeout'), config.timeoutMs)
  }

  if (controller && !config.signal) {
    config.signal = controller.signal
  }

  return config
})

// ---- Refresh pipeline (single-flight) ----
let isRefreshing = false
type Waiter = { onToken: (tok: string) => void; onError: (err: any) => void }
let pending: Waiter[] = []

async function refreshAccessToken(): Promise<string> {
  // Cookie-basiert; KEINE Authorization anhängen
  const { data } = await http.post<{ accessToken: string }>(
    '/auth/refresh',
    null,
    {
      headers: { 'Content-Type': 'application/json' },
      skipAuthHeader: true,
    },
  )
  // persist + default header aktualisieren
  setToken(data.accessToken)
  http.defaults.headers.common = setAuthHeader(
    http.defaults.headers.common,
    data.accessToken,
  )
  return data.accessToken
}

// ---- RESPONSE: Cleanup + Refresh + Auto-Retry ----
http.interceptors.response.use(
  (r) => {
    const g = (r.config as AxiosRequestConfig)?.cancelGroup
    if (g) inflightByGroup.delete(g)
    return r
  },
  async (error: AxiosError) => {
    const cfg = error.config as AxiosRequestConfig | undefined
    const resp = error.response

    // Cancel-Group Cleanup
    const g = cfg?.cancelGroup
    if (g) inflightByGroup.delete(g)

    if (!cfg || !resp) return Promise.reject(error)

    const url = (cfg.url ?? '').toString()
    const authCall = isAuthEndpoint(url)

    // 403: Beispiel-Redirect für Admin
    if (resp.status === 403) {
      if (url.startsWith('/admin/')) {
        try {
          window.location.replace('/my/tokens?denied=admin')
        } catch {}
      }
      return Promise.reject(error)
    }

    const isUnauth = resp.status === 401 || resp.status === 419

    // 401 auf anonymen Calls: direkt raus, kein Refresh
    if (isUnauth && cfg.allowAnonymous) {
      return Promise.reject(error)
    }

    // Refresh (nicht bei Auth-Endpunkten / nicht doppelt)
    if (isUnauth && !authCall && !cfg._retry) {
      cfg._retry = true

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const newTok = await refreshAccessToken()
          pending.forEach((w) => w.onToken(newTok))
          pending = []
        } catch (e) {
          pending.forEach((w) => w.onError(e))
          pending = []
          setToken('')
          delete (http.defaults.headers as any).common?.Authorization
          isRefreshing = false
          throw e
        } finally {
          isRefreshing = false
        }
      }

      // warten bis Refresh fertig und Original-Request wiederholen
      return new Promise<AxiosResponse>((resolve, reject) => {
        pending.push({
          onToken: (tok) => {
            cfg.headers = setAuthHeader(cfg.headers, tok)
            http.request(cfg).then(resolve).catch(reject)
          },
          onError: (err) => reject(err),
        })
      })
    }

    // ---- Auto-Retry bei transienten Fehlern (nur GET) ----
    const method = (cfg.method ?? 'get').toLowerCase()
    const attempt = (cfg._retryCount ?? 0) + 1
    const max = cfg.retry ?? 0

    const isTransient =
      transientStatus(resp?.status) ||
      error.code === 'ECONNABORTED' ||
      String(error.message || '')
        .toLowerCase()
        .includes('timeout')

    const canceled =
      error.code === 'ERR_CANCELED' ||
      error.message === 'newer request' ||
      error.message === 'manual abort'
    if (
      method === 'get' &&
      max > 0 &&
      attempt <= max &&
      isTransient &&
      !canceled
    ) {
      cfg._retryCount = attempt
      const wait = jitter(150, attempt - 1)
      await new Promise((res) => setTimeout(res, wait))
      return http.request(cfg)
    }

    return Promise.reject(error)
  },
)

// -------- Public API --------
export const Api = {
  // Auth
  async register(email: string, password: string): Promise<void> {
    await http.post(
      '/auth/register',
      { email, password },
      { skipAuthHeader: true },
    )
  },
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const { data } = await http.post<{ accessToken: string }>(
      '/auth/login',
      { email, password },
      { skipAuthHeader: true },
    )
    setToken(data.accessToken)
    http.defaults.headers.common = setAuthHeader(
      http.defaults.headers.common,
      data.accessToken,
    )
    return data
  },
  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout', null, { skipAuthHeader: true })
    } finally {
      setToken('')
      delete (http.defaults.headers as any).common?.Authorization
    }
  },
  async me(): Promise<{
    email: string
    roles: string[]
    id: string
    isLeader: boolean
  }> {
    const { data } = await http.get('/me')
    return data
  },
  async meAnonymousOk(): Promise<void> {
    await http.get('/me', { allowAnonymous: true })
  },
  async resetPassword(email: string): Promise<void> {
    await http.post('/auth/reset', { email }, { skipAuthHeader: true })
  },

  // --- Surveys ---
  async getSurvey(id: string): Promise<SurveyDto> {
    const { data } = await http.get<SurveyDto>(`/surveys/${id}`, {
      allowAnonymous: true, // public route
      cancelGroup: 'survey', // ältere Requests abbrechen
      retry: 2, // kurze Retries bei 50x/Timeout
      timeoutMs: 8000, // harte Obergrenze
    })
    return data
  },
  async submitSurveyResponses(
    id: string,
    body: SubmitSurveyRequest,
  ): Promise<void> {
    await http.post(`/surveys/${id}/responses`, body)
  },
  async getSurveyResults(id: string): Promise<SurveyResultsDto> {
    const { data } = await http.get<SurveyResultsDto>(
      `/surveys/${id}/results`,
      {
        retry: 2,
        timeoutMs: 8000,
      },
    )
    return data
  },
  async createSurvey(payload: CreateSurveyRequest): Promise<SurveyDto> {
    const { data } = await http.post<SurveyDto>('/surveys', payload)
    return data
  },
  async issueSurveyTokens(id: string, count: number): Promise<string[]> {
    const { data } = await http.post<string[]>(`/surveys/${id}/tokens/batch`, {
      count,
    })
    return data
  },
  buildSurveyInviteLink(surveyId: string, token: string): string {
    const base = window.location.origin
    return `${base}/surveys/${surveyId}?token=${encodeURIComponent(token)}`
  },

  // --- Leader ---
  async myTeams(leaderOnly = true): Promise<TeamLite[]> {
    const { data } = await http.get<TeamLite[]>('/me/teams', {
      params: { leaderOnly },
      cancelGroup: 'me/teams',
      retry: 2,
      timeoutMs: 8000,
    })
    return data
  },

  // --- Admin: Teamverwaltung ---
  async listTeamsAdmin(): Promise<TeamAdminDto[]> {
    const { data } = await http.get<TeamAdminDto[]>('/admin/teams', {
      cancelGroup: 'admin/teams',
      retry: 2,
      timeoutMs: 8000,
    })
    return data
  },
  async createTeamAdmin(name: string, leaderUserId: string): Promise<void> {
    await http.post('/admin/teams', null, { params: { name, leaderUserId } })
  },
  async addMemberAdmin(
    teamId: string,
    userId: string,
    leader = false,
  ): Promise<void> {
    await http.post(`/admin/teams/${teamId}/members`, null, {
      params: { userId, leader },
    })
  },
  async setLeaderAdmin(
    teamId: string,
    userId: string,
    leader: boolean,
  ): Promise<void> {
    await http.patch(`/admin/teams/${teamId}/leader`, null, {
      params: { userId, leader },
    })
  },
  async removeMemberAdmin(teamId: string, userId: string): Promise<void> {
    await http.delete(`/admin/teams/${teamId}/members/${userId}`)
  },
  async deleteTeamAdmin(teamId: string): Promise<void> {
    await http.delete(`/admin/teams/${teamId}`)
  },

  async listMySurveys(): Promise<(SurveyDto & { teamName?: string })[]> {
    const { data } = await http.get('/me/surveys', {
      cancelGroup: 'me/surveys',
      retry: 2,
      timeoutMs: 8000,
    })
    return data
  },
  async ensureTokensForTeam(surveyId: string): Promise<{ created: number }> {
    const { data } = await http.post<{ created: number }>(
      `/surveys/${surveyId}/tokens/for-members`,
    )
    return data
  },
  async myTokenForSurvey(
    surveyId: string,
  ): Promise<{ created: boolean; inviteLink?: string }> {
    const { data } = await http.get(`/surveys/${surveyId}/my-token`, {
      retry: 2,
      timeoutMs: 8000,
    })
    return data
  },
  async renewMyToken(
    surveyId: string,
  ): Promise<{ created: boolean; inviteLink: string }> {
    const { data } = await http.post(`/surveys/${surveyId}/my-token/renew`)
    return data
  },
  async listMyOpenTokens(): Promise<MyOpenToken[]> {
    const { data } = await http.get<MyOpenToken[]>('/my/tokens', {
      cancelGroup: 'my/tokens',
      retry: 2,
      timeoutMs: 8000,
    })
    return data
  },
}
