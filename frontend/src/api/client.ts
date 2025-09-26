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

// ---- Refresh pipeline: shared promise (single-flight, robust) ----
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

let refreshPromise: Promise<string> | null = null
function ensureRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .then((tok) => {
        refreshPromise = null
        return tok
      })
      .catch((e) => {
        refreshPromise = null
        setToken('')
        delete (http.defaults.headers as any).common?.Authorization
        throw e
      })
  }
  return refreshPromise
}

/** NEU: Session vorwärmen – holt per Cookie ein Access-Token, falls keins im Speicher ist. */
export async function prewarmSession(): Promise<boolean> {
  if (getToken()) return true
  try {
    await ensureRefresh()
    return !!getToken()
  } catch {
    return false
  }
}

let mePromise: Promise<any> | null = null
export async function fetchMeOnce() {
  if (!mePromise) {
    mePromise = http
      .get('/me', {
        cancelGroup: 'me', // ältere /me abbrechen
        retry: 0,
        timeoutMs: 8000,
      })
      .then((r) => r.data)
      .finally(() => {
        mePromise = null
      })
  }
  return mePromise
}

// NEU: Vor jedem Request sicherstellen, dass bei geschützen Routen ein Token vorhanden ist
async function ensureAccessTokenForRequest(
  cfg: AxiosRequestConfig,
): Promise<string | undefined> {
  if (isAuthEndpoint(cfg.url) || cfg.skipAuthHeader || cfg.allowAnonymous) {
    return undefined
  }
  const existing = getToken()
  if (existing) return existing
  // Falls kein Access-Token im Speicher: per Cookie refreshen (single-flight).
  try {
    return await ensureRefresh()
  } catch {
    // Kein Refresh möglich (z.B. kein Refresh-Cookie) → anonym weiter
    return undefined
  }
}

// ---- REQUEST: Auth + Cancel-Group + Per-Request Timeout ----
// WICHTIG: async, damit Pre-Flight-Refresh möglich ist
http.interceptors.request.use(async (config) => {
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

  // Beim Refresh/Login/etc. keine alte Authorization anhängen.
  if (!isAuthEndpoint(config.url) && !config.skipAuthHeader) {
    const token = (await ensureAccessTokenForRequest(config)) ?? getToken()
    config.headers = setAuthHeader(config.headers, token)
  }

  return config
})

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

    // 401/419 auf anonymen Calls nicht bubblen → stilles 204
    if (isUnauth && cfg.allowAnonymous) {
      return Promise.resolve({
        data: undefined,
        status: 204,
        statusText: 'No Content (anonymous)',
        headers: {},
        config: cfg,
      } as AxiosResponse)
    }

    // 401/419 → genau einmal refreshen und retryen (nicht bei Auth-Endpunkten)
    if (isUnauth && !authCall && !cfg._retry) {
      cfg._retry = true
      try {
        const newTok = await ensureRefresh()
        cfg.headers = setAuthHeader(cfg.headers, newTok)
        return http.request(cfg) // RETRY mit frischem Token
      } catch (e) {
        return Promise.reject(e)
      }
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
  prewarmSession,
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
    // NEU: vor dem /me-Call sicherstellen, dass ein gültiger Bearer da ist
    await prewarmSession()
    const data = await fetchMeOnce()
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

  // WICHTIG: Teilnahme ohne Login -> allowAnonymous setzen
  async submitSurveyResponses(
    id: string,
    body: SubmitSurveyRequest,
  ): Promise<void> {
    await http.post(`/surveys/${id}/responses`, body, {
      allowAnonymous: true,
      cancelGroup: 'survey-submit',
      timeoutMs: 10000,
    })
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
  async getResultsDownloadLink(id: string): Promise<string> {
    const { data } = await http.post<{ url: string }>(
      `/surveys/${id}/download-tokens`,
      {
        retry: 1,
        timeoutMs: 8000,
      },
    )
    return data.url
  },

  async verifyEmail(token: string): Promise<void> {
    await http.post('/auth/verify', { token }, { skipAuthHeader: true })
  },

  // Invite-Link für Teilnehmer (ohne /api → öffnet die SPA)
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
  // Team anlegen: JSON-Body, 201 Created
  async createTeamAdmin(name: string, leaderUserId: string): Promise<void> {
    await http.post('/admin/teams', { name, leaderUserId })
  },

  // Mitglied anlegen/aktualisieren (idempotent)
  async addOrUpdateMemberAdmin(
    teamId: string,
    userId: string,
    leader = false,
  ): Promise<void> {
    await http.put(`/admin/teams/${teamId}/members/${userId}`, { leader })
  },

  // setLeaderAdmin -> konsolidiert in addOrUpdateMemberAdmin()
  async setLeaderAdmin(
    teamId: string,
    userId: string,
    leader: boolean,
  ): Promise<void> {
    await http.put(`/admin/teams/${teamId}/members/${userId}`, { leader })
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
    const { data } = await http.put(`/surveys/${surveyId}/my-token`, {
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
