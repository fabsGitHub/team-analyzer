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
  type GenericAbortSignal,
  type InternalAxiosRequestConfig,
} from 'axios'

// ───────────────────────────────────────────────────────────────────────────────
// Axios-Config erweitern (zusätzliche Flags + interne Felder)
// ───────────────────────────────────────────────────────────────────────────────
declare module 'axios' {
  export interface AxiosRequestConfig<D = any> {
    /** 401 ok, kein Refresh-/Retry-Versuch (z.B. /me auf öffentlicher Seite) */
    allowAnonymous?: boolean
    /** Für diesen Request keinen Authorization-Bearer anhängen */
    skipAuthHeader?: boolean
    /** Älteren Request derselben Gruppe abbrechen (z.B. "survey") */
    cancelGroup?: string
    /** Anzahl Auto-Retries bei transienten Fehlern (nur GET) */
    retry?: number
    /** Per-Request Timeout in ms (via AbortController) */
    timeoutMs?: number

    // interne Marker:
    /** intern: wurde schon refresh-retried */
    _retry?: boolean
    /** intern: Zähler für Auto-Retries */
    _retryCount?: number
    /** intern: Controller für Cancel-Group/Timeout */
    _abortController?: AbortController
    /** intern: Timeout-Timer-ID */
    _timeoutId?: number
  }

  // WICHTIG: auch InternalAxiosRequestConfig erweitern, da Interceptors diesen Typ nutzen
  export interface InternalAxiosRequestConfig<D = any>
    extends AxiosRequestConfig<D> {
    allowAnonymous?: boolean
    skipAuthHeader?: boolean
    cancelGroup?: string
    retry?: number
    timeoutMs?: number
    _retry?: boolean
    _retryCount?: number
    _abortController?: AbortController
    _timeoutId?: number
    // signal ist bereits GenericAbortSignal, nur hier der Vollständigkeit halber:
    signal?: GenericAbortSignal
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Konstanten
// ───────────────────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? '/api'
const BACKOFF_BASE_MS = 150
const BACKOFF_CAP_MS = 2000 // Obergrenze für Backoff-Jitter

// ───────────────────────────────────────────────────────────────────────────────
// Cancel-Gruppen-Registry
// ───────────────────────────────────────────────────────────────────────────────
const inflightByGroup = new Map<string, AbortController>()

export function abortGroup(group: string) {
  inflightByGroup.get(group)?.abort('manual abort')
  inflightByGroup.delete(group)
}

// ───────────────────────────────────────────────────────────────────────────────
/** Erkenne transiente Statuscodes (vorübergehende Störungen) */
function isTransientStatus(s?: number) {
  return s === 0 || s === 502 || s === 503 || s === 504
}

/** Fixed-Jitter Backoff (exponentiell, gedeckelt, +0..jitterMs-1) */
function backoffWithFixedJitter(
  baseMs: number,
  attempt: number, // 0-basiert
  capMs = BACKOFF_CAP_MS,
  jitterMs = 100,
) {
  const raw = baseMs * Math.pow(2, attempt)
  const delay = Math.min(raw, capMs)
  return delay + Math.floor(Math.random() * jitterMs)
}

/** Zwei Abort-Signale „verknoten“: externer Abort triggert unseren Controller */
function chainAbortSignals(
  primary: AbortController,
  external?: GenericAbortSignal,
) {
  if (!external) return
  const sig: any = external
  if (sig.aborted) {
    primary.abort(sig.reason ?? 'upstream abort')
    return
  }
  if (typeof sig.addEventListener === 'function') {
    const onAbort = () => primary.abort(sig.reason ?? 'upstream abort')
    sig.addEventListener('abort', onAbort, { once: true })
  }
}

/** Sichere URL-Parser-Helfer (relative URLs erlaubt) */
function parseUrl(url?: string | null): URL | null {
  if (!url) return null
  try {
    return new URL(
      url,
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost',
    )
  } catch {
    return null
  }
}

/** Auth-Endpoints robust erkennen (Pfadvergleich, keine substring-Falschpositiven) */
const AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
])
function isAuthEndpoint(url?: string | null): boolean {
  const u = parseUrl(url)
  return !!u && AUTH_PATHS.has(u.pathname)
}

/** Admin-Pfad-Erkennung (z. B. für 403-Redirect-Logik) */
function isAdminPath(url?: string | null): boolean {
  const u = parseUrl(url)
  return !!u && u.pathname.startsWith('/admin/')
}

// ───────────────────────────────────────────────────────────────────────────────
// Token-Wiring (vom Store injiziert)
// ───────────────────────────────────────────────────────────────────────────────
let getToken: () => string = () => ''
let setToken: (t: string) => void = () => {}
export function useAuthToken(
  getter: () => string,
  setter: (t: string) => void,
) {
  getToken = getter
  setToken = setter
}

// ───────────────────────────────────────────────────────────────────────────────
// Axios-Instanz
// ───────────────────────────────────────────────────────────────────────────────
export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // nötig für Cookie-basiertes Refresh
  headers: { 'Content-Type': 'application/json' },
  // optional global fallback: timeout: 15000,
})

// ───────────────────────────────────────────────────────────────────────────────
// Header-Helper
// ───────────────────────────────────────────────────────────────────────────────
function setAuthHeader(headers: any, token?: string) {
  const h = headers ?? {}
  if (token) h['Authorization'] = `Bearer ${token}`
  else delete h['Authorization']
  return h
}

// ───────────────────────────────────────────────────────────────────────────────
// Refresh-Pipeline (Single-Flight)
// ───────────────────────────────────────────────────────────────────────────────
async function refreshAccessToken(): Promise<string> {
  // Cookie-basiert; KEINE Authorization anhängen
  const { data } = await http.post<{ accessToken: string }>(
    '/auth/refresh',
    undefined, // kein Body senden
    { skipAuthHeader: true }, // Bearer auslassen; Cookie reicht
  )

  if (!data || typeof data.accessToken !== 'string' || !data.accessToken) {
    throw new Error('Invalid refresh response')
  }

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

/** Session vorwärmen – holt per Cookie ein Access-Token, falls keins im Speicher ist. */
export async function prewarmSession(): Promise<boolean> {
  if (getToken()) return true
  try {
    await ensureRefresh()
    return !!getToken()
  } catch {
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// /me nur einmal parallel laden (Single-Flight)
// ───────────────────────────────────────────────────────────────────────────────
let mePromise: Promise<any> | null = null
export async function fetchMeOnce(allowAnonymous = false) {
  if (!mePromise) {
    mePromise = http
      .get('/me', {
        allowAnonymous,
        cancelGroup: 'me',
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

// ───────────────────────────────────────────────────────────────────────────────
// Sicherstellen: Vor geschützten Calls ein gültiger Bearer
// ───────────────────────────────────────────────────────────────────────────────
async function ensureAccessTokenForRequest(
  cfg: InternalAxiosRequestConfig,
): Promise<string | undefined> {
  if (isAuthEndpoint(cfg.url) || cfg.skipAuthHeader || cfg.allowAnonymous)
    return undefined
  const existing = getToken()
  if (existing) return existing
  try {
    return await ensureRefresh()
  } catch {
    // Kein Refresh möglich (z.B. kein Refresh-Cookie) → anonym weiter
    return undefined
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// REQUEST-INTERCEPTOR: Auth + Cancel-Group + Per-Request Timeout (async)
// ───────────────────────────────────────────────────────────────────────────────
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Cancel-Group: älteren abbrechen, neuen Controller registrieren
  let controller: AbortController | undefined
  if (config.cancelGroup) {
    inflightByGroup.get(config.cancelGroup)?.abort('newer request')
    controller = new AbortController()
    inflightByGroup.set(config.cancelGroup, controller)
    ;(config as any)._abortController = controller
  }

  // Per-Request Timeout
  if (config.timeoutMs) {
    controller = controller ?? new AbortController()
    const tid = window.setTimeout(
      () => controller?.abort('timeout'),
      config.timeoutMs,
    )
    ;(config as any)._timeoutId = tid
  }

  // Externes Signal beachten (falls vorhanden) und mit unserem Controller verknoten
  if (controller) {
    chainAbortSignals(
      controller,
      config.signal as GenericAbortSignal | undefined,
    )
    // Axios erwartet GenericAbortSignal; DOM AbortSignal passt via cast
    config.signal = controller.signal as unknown as GenericAbortSignal
  }

  // Beim Refresh/Login/etc. keine Authorization anhängen
  if (!isAuthEndpoint(config.url) && !config.skipAuthHeader) {
    const token = (await ensureAccessTokenForRequest(config)) ?? getToken()
    config.headers = setAuthHeader(config.headers, token)
  }

  return config
})

// ───────────────────────────────────────────────────────────────────────────────
/** Gemeinsames Cleanup für Success/Error: Race-sicher + Timer räumen */
function cleanupAfterResponse(
  cfg?: InternalAxiosRequestConfig | AxiosRequestConfig,
) {
  if (!cfg) return
  const g = (cfg as any).cancelGroup as string | undefined
  const ctrl = (cfg as any)._abortController as AbortController | undefined
  if (g && inflightByGroup.get(g) === ctrl) {
    inflightByGroup.delete(g)
  }
  const tid = (cfg as any)._timeoutId as number | undefined
  if (tid) clearTimeout(tid)
}

// RESPONSE-INTERCEPTOR: Cleanup + Refresh + Auto-Retry
http.interceptors.response.use(
  (r) => {
    cleanupAfterResponse(r.config as InternalAxiosRequestConfig)
    return r
  },
  async (error: AxiosError) => {
    const cfg = error.config as InternalAxiosRequestConfig | undefined
    const resp = error.response
    cleanupAfterResponse(cfg)

    // Ohne Config können wir nicht sinnvoll weitermachen
    if (!cfg) return Promise.reject(error)

    const urlStr = (cfg.url ?? '').toString()
    const authCall = isAuthEndpoint(urlStr)

    // 403: Beispiel-Redirect für Admin
    if (resp?.status === 403) {
      if (isAdminPath(urlStr)) {
        try {
          const target = '/my/tokens?denied=admin'
          if (window.location.pathname + window.location.search !== target) {
            window.location.replace(target)
          }
        } catch {}
      }
      return Promise.reject(error)
    }

    const isUnauth = resp?.status === 401 || resp?.status === 419

    // 401/419 auf anonymen Calls nicht bubblen → stilles 204
    if (isUnauth && cfg.allowAnonymous) {
      const synthetic: AxiosResponse<undefined> = {
        data: undefined,
        status: 204,
        statusText: 'No Content (anonymous)',
        headers: {},
        // Cast: AxiosResponse.config erwartet InternalAxiosRequestConfig
        config: cfg as InternalAxiosRequestConfig,
      }
      return Promise.resolve(synthetic)
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
    const method = (cfg.method ?? 'get').toString().toLowerCase()
    const attempt = (cfg._retryCount ?? 0) + 1
    const max = cfg.retry ?? 0

    const maybeTransient =
      isTransientStatus(resp?.status) ||
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
      maybeTransient &&
      !canceled
    ) {
      cfg._retryCount = attempt
      const wait = backoffWithFixedJitter(
        BACKOFF_BASE_MS,
        attempt - 1,
        BACKOFF_CAP_MS,
        100,
      )
      await new Promise((res) => setTimeout(res, wait))
      return http.request(cfg)
    }

    return Promise.reject(error)
  },
)

// ───────────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────────
export const Api = {
  prewarmSession,

  // --- Auth ---
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
    await prewarmSession()
    const data = await fetchMeOnce()
    return data
  },

  async meAnonymousOk(): Promise<void> {
    await fetchMeOnce(true)
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

  // Teilnahme ohne Login -> allowAnonymous setzen
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
      null,
      { retry: 1, timeoutMs: 8000 },
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
    const { data } = await http.put(`/surveys/${surveyId}/my-token`, null, {
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
