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

// ==== NEW: eigene Flags an Axios-Config ====
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 401 ok, kein Refresh-/Retry-Versuch (z.B. /me auf öffentlicher Seite) */
    allowAnonymous?: boolean
    /** Für diesen Request keinen Authorization-Bearer anhängen */
    skipAuthHeader?: boolean
  }
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

// request: attach Authorization (außer bei Auth-Endpunkten)
http.interceptors.request.use((config) => {
  // sehr wichtig: beim Refresh/Login/… KEINE alte Authorization anhängen
  if (isAuthEndpoint(config.url)) return config
  if (!config.skipAuthHeader) {
    const token = getToken()
    config.headers = setAuthHeader(config.headers, token)
  }
  return config
})

// refresh pipeline (single-flight)
let isRefreshing = false
type Waiter = { onToken: (tok: string) => void; onError: (err: any) => void }
let pending: Waiter[] = []

async function refreshAccessToken(): Promise<string> {
  // läuft cookie-basiert; KEINE Authorization anhängen (s. Request-Interceptor)
  const { data } = await http.post<{ accessToken: string }>(
    '/auth/refresh',
    null,
    {
      headers: { 'Content-Type': 'application/json' },
      // optional defensiv:
      skipAuthHeader: true, // NEW: stellt sicher, dass nie ein Bearer dran hängt
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

// response: on 401/419 -> refresh once and retry
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const resp = error.response
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined
    if (!original || !resp) return Promise.reject(error)

    const url = (original.url ?? '').toString()
    const authCall = isAuthEndpoint(url)

    // 403: Admin access denied redirect
    if (resp.status === 403) {
      if (url.startsWith('/admin/')) {
        try {
          window.location.replace('/my/tokens?denied=admin')
        } catch {}
      }
      return Promise.reject(error)
    }

    const isUnauth = resp.status === 401 || resp.status === 419

    // ==== NEW: 401 für anonyme Calls einfach durchreichen, kein Refresh
    if (isUnauth && original.allowAnonymous) {
      return Promise.reject(error)
    }

    // Nicht bei Auth-Endpunkten oder bereits geretryten Requests refreshen
    if (!isUnauth || authCall || original._retry) {
      return Promise.reject(error)
    }

    original._retry = true

    // orchestrierter Single-Flight-Refresh
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
        throw e
      } finally {
        isRefreshing = false
      }
    }

    // Warten bis refresh fertig, dann original erneut senden
    return new Promise<AxiosResponse>((resolve, reject) => {
      pending.push({
        onToken: (tok) => {
          original.headers = setAuthHeader(original.headers, tok)
          http.request(original).then(resolve).catch(reject)
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
    await http.post(
      '/auth/register',
      { email, password },
      { skipAuthHeader: true },
    ) // NEW: sicherheitshalber
  },
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const { data } = await http.post<{ accessToken: string }>(
      '/auth/login',
      { email, password },
      { skipAuthHeader: true }, // NEW
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
      await http.post('/auth/logout', null, { skipAuthHeader: true }) // NEW
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
    // Tipp: für öffentliche Seiten ggf. { allowAnonymous: true } setzen
    const { data } = await http.get('/me')
    return data
  },
  async meAnonymousOk(): Promise<void> {
    // optionales Helferlein für Navbar auf öffentlichen Seiten
    await http.get('/me', { allowAnonymous: true })
  },
  async resetPassword(email: string): Promise<void> {
    await http.post('/auth/reset', { email }, { skipAuthHeader: true }) // NEW
  },

  // --- Surveys ---
  async getSurvey(id: string): Promise<SurveyDto> {
    const { data } = await http.get<SurveyDto>(`/surveys/${id}`)
    return data
  },
  async submitSurveyResponses(
    id: string,
    body: SubmitSurveyRequest,
  ): Promise<void> {
    await http.post(`/surveys/${id}/responses`, body)
  },
  async getSurveyResults(id: string): Promise<SurveyResultsDto> {
    const { data } = await http.get<SurveyResultsDto>(`/surveys/${id}/results`)
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
    })
    return data
  },

  // --- Admin: Teamverwaltung ---
  async listTeamsAdmin(): Promise<TeamAdminDto[]> {
    const { data } = await http.get<TeamAdminDto[]>('/admin/teams')
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
    const { data } = await http.get('/me/surveys')
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
    const { data } = await http.get(`/surveys/${surveyId}/my-token`)
    return data
  },
  async renewMyToken(
    surveyId: string,
  ): Promise<{ created: boolean; inviteLink: string }> {
    const { data } = await http.post(`/surveys/${surveyId}/my-token/renew`)
    return data
  },
  async listMyOpenTokens(): Promise<MyOpenToken[]> {
    const { data } = await http.get<MyOpenToken[]>('/my/tokens')
    return data
  },
}
