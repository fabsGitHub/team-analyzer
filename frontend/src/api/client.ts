import type {
  SurveyDto,
  SubmitSurveyRequest,
  SurveyResultsDto,
  CreateSurveyRequest,
  TeamLite,
  TeamAdminDto,
} from '@/types'
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

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
  if (!headers) headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    delete headers['Authorization']
  }
  return headers
}

// request: attach Authorization
http.interceptors.request.use((config) => {
  const token = getToken()
  config.headers = setAuthHeader(config.headers, token)
  return config
})

// refresh pipeline
let isRefreshing = false
type Waiter = { onToken: (tok: string) => void; onError: (err: any) => void }
let pending: Waiter[] = []

async function refreshAccessToken(): Promise<string> {
  // Wichtig: diese Anfrage läuft cookie-basiert (refresh_token-Cookie)
  const { data } = await http.post<{ accessToken: string }>(
    '/auth/refresh',
    null,
    {
      // beim Refresh KEIN alter Bearer erzwingen
      headers: { 'Content-Type': 'application/json' },
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

// response: on 401 -> refresh once and retry
http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const resp = error.response
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined

    // Kein config/Response? -> weiterwerfen
    if (!original || !resp) {
      return Promise.reject(error)
    }

    // Auth-Endpoints selbst nie refreshen
    const url = (original.url ?? '').toString()
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    // Nur bei 401, nicht bei bereits geretryten Requests
    if (resp.status !== 401 || isAuthEndpoint || original._retry) {
      return Promise.reject(error)
    }

    // Markiere als Retry
    original._retry = true

    // Refresh orchestrieren (nur einmal parallel)
    if (!isRefreshing) {
      isRefreshing = true
      try {
        const newTok = await refreshAccessToken()
        // ausstehende waiters informieren
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

    // Warten bis refresh fertig, dann original erneut senden
    return new Promise<AxiosResponse>((resolve, reject) => {
      pending.push({
        onToken: (tok) => {
          // Header des ursprünglichen Requests mit neuem Token bestücken
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
    http.defaults.headers.common = setAuthHeader(
      http.defaults.headers.common,
      data.accessToken,
    )
    return data
  },
  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout')
    } finally {
      setToken('')
      delete (http.defaults.headers as any).common?.Authorization
    }
  },
  async me(): Promise<{ email: string; roles: string[]; id: string, isLeader: boolean }> {
    const { data } = await http.get('/me')
    return data
  },
  async resetPassword(email: string): Promise<void> {
    await http.post('/auth/reset', { email })
  },

  // --- Surveys (öffentlich/leader/admin kombi) ---
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

  // --- Leader: eigene Teams (für DropDown) ---
  async myTeams(): Promise<TeamLite[]> {
    const { data } = await http.get<TeamLite[]>('/me/teams')
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
}
