// src/store.ts
import { reactive } from 'vue'
import { Api, abortGroup, useAuthToken } from '@/api/client'
import { i18n } from '@/i18n'
import type {
  SurveyDto,
  SurveyResultsDto,
  TeamLite,
  TeamAdminDto,
  CreateSurveyRequest,
  SubmitSurveyRequest,
  Toast as ToastType,
} from '@/types'

// ───────────────────────────────────────────────────────────────────────────────
// Konstanten
// ───────────────────────────────────────────────────────────────────────────────
const TOAST_AUTOHIDE_MS = 2500 as const

// Bereiche/Keys für "latest wins"
const RUN = {
  SURVEY: 'survey',
  RESULTS: 'results',
  ME_TEAMS: 'me/teams',
  ADMIN_TEAMS: 'admin/teams',
  ME_SURVEYS: 'me/surveys',
  MY_TOKENS: 'my/tokens',
} as const

// Cancel-Gruppen (gleich benannt wie RUN, aber getrennt definiert falls abweichend nötig)
const GROUP = {
  SURVEY: 'survey',
  SURVEY_SUBMIT: 'survey-submit',
  ME_TEAMS: 'me/teams',
  ME_SURVEYS: 'me/surveys',
  MY_TOKENS: 'my/tokens',
  ADMIN_TEAMS: 'admin/teams',
} as const

// ───────────────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}
const $t = (k: string) => (i18n.global as any).t(k) as string

// "latest wins" pro Bereich
const latestRun: Record<string, string> = {}
function newRun(key: string) {
  const id = uuid()
  latestRun[key] = id
  return id
}
function isStale(key: string, id: string) {
  return latestRun[key] !== id
}
function isCanceledError(e: any) {
  const msg = String(e?.message || '').toLowerCase()
  return (
    e?.code === 'ERR_CANCELED' ||
    msg.includes('abort') ||
    msg.includes('canceled')
  )
}

// Gemeinsame Loader-Helfer: weniger Boilerplate in den Actions
function beginLoad(
  key: string,
  opts?: {
    group?: string
    setLoading?: (v: boolean) => void
    setError?: (s: string) => void
  },
) {
  const id = newRun(key)
  if (opts?.group) {
    try {
      abortGroup(opts.group)
    } catch {}
  }
  opts?.setLoading?.(true)
  opts?.setError?.('')
  return id
}
function endLoad(
  key: string,
  id: string,
  opts?: { setLoading?: (v: boolean) => void },
) {
  if (!isStale(key, id)) opts?.setLoading?.(false)
}
function guardStale<T>(key: string, id: string, value?: T) {
  // Wenn veraltet, nichts mehr ändern / optionalen Rückgabewert liefern
  if (isStale(key, id)) return { stale: true as const, value }
  return { stale: false as const }
}
function handleLoadError(
  key: string,
  id: string,
  e: any,
  opts?: { setError?: (s: string) => void },
) {
  if (isCanceledError(e)) return { handled: true }
  if (isStale(key, id)) return { handled: true }
  opts?.setError?.(e?.message || String(e))
  return { handled: false }
}

// i18n-Setter (Composition + Legacy kompatibel)
function setI18nLocale(lang: string) {
  const loc = (i18n.global as any).locale
  if (loc && typeof loc === 'object' && 'value' in loc) {
    loc.value = lang
  } else {
    ;(i18n.global as any).locale = lang
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// State & API-Schnittstelle
// ───────────────────────────────────────────────────────────────────────────────
interface State {
  token: string
  user: {
    email: string
    roles: string[]
    id?: string
    isLeader?: boolean
  } | null
  toasts: ToastType[]
  loading: boolean
  error: string

  currentSurvey: SurveyDto | null
  surveyLoading: boolean
  surveyError: string
  lastSubmittedSurveyId: string

  results: SurveyResultsDto | null
  resultsLoading: boolean
  resultsError: string

  myTeams: TeamLite[]
  leaderLoading: boolean
  leaderError: string
  lastCreatedSurveyId: string
  issuedTokens: string[]

  teamsAdmin: TeamAdminDto[]
  adminLoading: boolean
  adminError: string

  language?: string
}

interface StoreApi {
  state: State
  // auth
  setUser(u: { email: string; roles: string[] } | null): void
  init(): Promise<void>
  login(email: string, password: string): Promise<void>
  register(email: string, password: string): Promise<void>
  logout(): Promise<void>
  resetPassword(email: string): Promise<void>
  setToken(t: string): void
  // survey public
  loadSurvey(surveyId: string): Promise<void>
  submitSurvey(surveyId: string, body: SubmitSurveyRequest): Promise<void>
  loadSurveyResults(surveyId: string): Promise<SurveyResultsDto | null>
  // leader
  loadMyTeams(): Promise<TeamLite[]>
  createSurvey(payload: CreateSurveyRequest): Promise<SurveyDto>
  issueTokens(surveyId: string, count: number): Promise<string[]>
  inviteLinkFor(token: string): string
  // admin
  loadTeamsAdmin(): Promise<TeamAdminDto[]>
  createTeamAdmin(name: string, leaderUserId: string): Promise<void>
  addMemberAdmin(
    teamId: string,
    userId: string,
    leader?: boolean,
  ): Promise<void>
  setLeaderAdmin(teamId: string, userId: string, leader: boolean): Promise<void>
  removeMemberAdmin(teamId: string, userId: string): Promise<void>
  // ui
  toast(text: string, type?: ToastType['type']): void
  dismiss(id: string): void
  setLanguage(lang: string): void
}

// Reaktiver State
const state: State = reactive({
  token: '',
  user: null,
  toasts: [],
  loading: false,
  error: '',

  currentSurvey: null,
  surveyLoading: false,
  surveyError: '',
  lastSubmittedSurveyId: '',

  results: null,
  resultsLoading: false,
  resultsError: '',

  myTeams: [],
  leaderLoading: false,
  leaderError: '',
  lastCreatedSurveyId: '',
  issuedTokens: [],

  teamsAdmin: [],
  adminLoading: false,
  adminError: '',

  language: 'de',
})

// Token zwischen Store ⟷ Api-Client verdrahten
useAuthToken(
  () => state.token,
  (t) => {
    state.token = t
  },
)

// UI-Helpers
const isLoggedIn = () => !!state.user?.email
function dismiss(id: string) {
  state.toasts = state.toasts.filter((t) => t.id !== id)
}
function toast(text: string, type?: ToastType['type']) {
  const id = uuid()
  state.toasts.push({ id, text, type })
  setTimeout(() => dismiss(id), TOAST_AUTOHIDE_MS)
}

// ───────────────────────────────────────────────────────────────────────────────
// Store-Factory
// ───────────────────────────────────────────────────────────────────────────────
export const useStore = (): StoreApi => {
  // --- Auth ---
  function setUser(u: { email: string; roles: string[] } | null) {
    state.user = u
  }

  // WICHTIG: init() soll auf Public-Seiten keinen Refresh triggern
  async function init() {
    // Sprache aus Storage holen
    try {
      const saved =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('app.lang') ||
            localStorage.getItem('app.lang')
          : null
      if (saved === 'de' || saved === 'en') {
        state.language = saved
        setI18nLocale(saved)
      }
    } catch {}

    state.loading = true
    state.error = ''
    try {
      // "soft" /me: 401 erlaubt → kein Refresh
      await Api.meAnonymousOk()
      // Falls bereits eingeloggt, holt der Router-Guard später das echte /me
    } finally {
      state.loading = false
    }
  }

  async function login(email: string, password: string) {
    await Api.login(email, password)
    state.user = await Api.me()
    toast($t('toast.signedin'))
  }

  async function register(email: string, password: string) {
    await Api.register(email, password)
    toast($t('auth.check_mail'))
  }

  async function logout() {
    // laufende Gruppen abbrechen, um Race-Conditions nach Logout zu vermeiden
    try {
      abortGroup(GROUP.SURVEY)
      abortGroup(GROUP.ME_TEAMS)
      abortGroup(GROUP.ME_SURVEYS)
      abortGroup(GROUP.MY_TOKENS)
      abortGroup(GROUP.ADMIN_TEAMS)
    } catch {}
    await Api.logout()
    state.user = null
    state.token = ''
    toast($t('toast.signedout'))
  }

  async function resetPassword(email: string) {
    await Api.resetPassword(email)
    toast($t('auth.reset_sent'))
  }

  function setToken(t: string) {
    state.token = t
  }

  // --- Survey (public) ---
  async function loadSurvey(surveyId: string) {
    const runId = beginLoad(RUN.SURVEY, {
      group: GROUP.SURVEY,
      setLoading: (v) => (state.surveyLoading = v),
      setError: (s) => (state.surveyError = s),
    })
    state.currentSurvey = null

    try {
      const dto = await Api.getSurvey(surveyId)
      if (guardStale(RUN.SURVEY, runId).stale) return
      state.currentSurvey = dto
    } catch (e: any) {
      if (
        !handleLoadError(RUN.SURVEY, runId, e, {
          setError: (s) => (state.surveyError = s),
        }).handled
      ) {
        throw e
      }
    } finally {
      endLoad(RUN.SURVEY, runId, {
        setLoading: (v) => (state.surveyLoading = v),
      })
    }
  }

  async function submitSurvey(surveyId: string, body: SubmitSurveyRequest) {
    await Api.submitSurveyResponses(surveyId, body)
    state.lastSubmittedSurveyId = surveyId
    toast($t('survey.thanks') || 'Danke für die Teilnahme!')
  }

  async function loadSurveyResults(surveyId: string) {
    const runId = beginLoad(RUN.RESULTS, {
      setLoading: (v) => (state.resultsLoading = v),
      setError: (s) => (state.resultsError = s),
    })

    try {
      const r = await Api.getSurveyResults(surveyId)
      if (guardStale(RUN.RESULTS, runId, state.results).stale)
        return state.results
      state.results = r
      return r
    } catch (e: any) {
      if (
        !handleLoadError(RUN.RESULTS, runId, e, {
          setError: (s) => (state.resultsError = s),
        }).handled
      ) {
        throw e
      }
      return state.results
    } finally {
      endLoad(RUN.RESULTS, runId, {
        setLoading: (v) => (state.resultsLoading = v),
      })
    }
  }

  // --- Leader ---
  async function loadMyTeams() {
    const runId = beginLoad(RUN.ME_TEAMS, {
      setLoading: (v) => (state.leaderLoading = v),
      setError: (s) => (state.leaderError = s),
    })

    try {
      if (!isLoggedIn()) {
        state.myTeams = []
        return []
      }
      const teams = await Api.myTeams()
      if (guardStale(RUN.ME_TEAMS, runId, state.myTeams).stale)
        return state.myTeams
      state.myTeams = teams
      return teams
    } catch (e: any) {
      if (
        !handleLoadError(RUN.ME_TEAMS, runId, e, {
          setError: (s) => (state.leaderError = s),
        }).handled
      ) {
        throw e
      }
      return state.myTeams
    } finally {
      endLoad(RUN.ME_TEAMS, runId, {
        setLoading: (v) => (state.leaderLoading = v),
      })
    }
  }

  async function createSurvey(payload: CreateSurveyRequest) {
    state.leaderLoading = true
    state.leaderError = ''
    try {
      const dto = await Api.createSurvey(payload)
      state.lastCreatedSurveyId = dto.id
      toast($t('survey.created') || 'Survey erstellt.')
      return dto
    } catch (e: any) {
      state.leaderError = e?.message || String(e)
      throw e
    } finally {
      state.leaderLoading = false
    }
  }

  async function issueTokens(surveyId: string, count: number) {
    state.leaderLoading = true
    state.leaderError = ''
    try {
      state.issuedTokens = await Api.issueSurveyTokens(surveyId, count)
      return state.issuedTokens
    } catch (e: any) {
      state.leaderError = e?.message || String(e)
      throw e
    } finally {
      state.leaderLoading = false
    }
  }

  function inviteLinkFor(token: string) {
    return Api.buildSurveyInviteLink(state.lastCreatedSurveyId, token)
  }

  // --- Admin ---
  async function loadTeamsAdmin() {
    const runId = beginLoad(RUN.ADMIN_TEAMS, {
      setLoading: (v) => (state.adminLoading = v),
      setError: (s) => (state.adminError = s),
    })

    try {
      const teams = await Api.listTeamsAdmin()
      if (guardStale(RUN.ADMIN_TEAMS, runId, state.teamsAdmin).stale)
        return state.teamsAdmin
      state.teamsAdmin = teams
      return teams
    } catch (e: any) {
      if (
        !handleLoadError(RUN.ADMIN_TEAMS, runId, e, {
          setError: (s) => (state.adminError = s),
        }).handled
      ) {
        throw e
      }
      return state.teamsAdmin
    } finally {
      endLoad(RUN.ADMIN_TEAMS, runId, {
        setLoading: (v) => (state.adminLoading = v),
      })
    }
  }

  async function createTeamAdmin(name: string, leaderUserId: string) {
    await Api.createTeamAdmin(name, leaderUserId)
    toast($t('team.created') || 'Team erstellt.')
    await loadTeamsAdmin()
  }

  async function addMemberAdmin(
    teamId: string,
    userId: string,
    leader = false,
  ) {
    await Api.addOrUpdateMemberAdmin(teamId, userId, leader)
    toast($t('team.member_added') || 'Mitglied hinzugefügt.')
    await loadTeamsAdmin()
  }

  async function setLeaderAdmin(
    teamId: string,
    userId: string,
    leader: boolean,
  ) {
    await Api.addOrUpdateMemberAdmin(teamId, userId, leader)
    toast($t('team.leader_updated') || 'Leader aktualisiert.')
    await loadTeamsAdmin()
  }

  async function removeMemberAdmin(teamId: string, userId: string) {
    await Api.removeMemberAdmin(teamId, userId)
    toast($t('team.member_removed') || 'Mitglied entfernt.')
    await loadTeamsAdmin()
  }

  // --- UI ---
  function setLanguage(lang: string) {
    state.language = lang
    setI18nLocale(lang)
    try {
      sessionStorage.setItem('app.lang', lang) // nur für diese Sitzung
    } catch {}
  }

  return {
    state,
    // auth
    setUser,
    init,
    login,
    register,
    logout,
    resetPassword,
    setToken,
    // survey
    loadSurvey,
    submitSurvey,
    loadSurveyResults,
    // leader
    loadMyTeams,
    createSurvey,
    issueTokens,
    inviteLinkFor,
    // admin
    loadTeamsAdmin,
    createTeamAdmin,
    addMemberAdmin,
    setLeaderAdmin,
    removeMemberAdmin,
    // ui
    toast,
    dismiss,
    setLanguage,
  }
}
