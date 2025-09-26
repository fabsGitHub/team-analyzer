// src/store.ts
import { reactive } from 'vue'
import { Api, useAuthToken } from '@/api/client'
import { abortGroup } from '@/api/client' // << NEU: zum gezielten Abbrechen
import { i18n } from '@/i18n'
import type {
  SurveyDto,
  SurveyResultsDto,
  TeamLite,
  TeamAdminDto,
  CreateSurveyRequest,
  Toast as ToastType,
} from '@/types'

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}
const $t = (k: string) => (i18n.global as any).t(k) as string

// ---- Helper: "latest wins" pro Bereich ----
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
  submitSurvey(
    surveyId: string,
    body: {
      token: string
      q1: number
      q2: number
      q3: number
      q4: number
      q5: number
    },
  ): Promise<void>
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

const isLoggedIn = () => !!state.user?.email
function dismiss(id: string) {
  state.toasts = state.toasts.filter((t) => t.id !== id)
}
function toast(text: string, type?: ToastType['type']) {
  const id = uuid()
  state.toasts.push({ id, text, type })
  setTimeout(() => dismiss(id), 2500)
}

function setI18nLocale(lang: string) {
  const loc = (i18n.global as any).locale
  if (loc && typeof loc === 'object' && 'value' in loc) {
    loc.value = lang // Composition API
  } else {
    ;(i18n.global as any).locale = lang // Fallback
  }
}

useAuthToken(
  () => state.token,
  (t) => (state.token = t),
)

export const useStore = (): StoreApi => {
  // --- Auth ---
  function setUser(u: { email: string; roles: string[] } | null) {
    state.user = u
  }

  // WICHTIG: init() soll auf Public-Seiten keinen Refresh triggern
  async function init() {
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
      // wenn der Benutzer bereits eingeloggt ist, holt der Routen-Guard später das echte /me
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
      abortGroup('survey')
      abortGroup('me/teams')
      abortGroup('me/surveys')
      abortGroup('my/tokens')
      abortGroup('admin/teams')
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
    // "latest wins" + evtl. vorherige Requests hart abbrechen
    const run = newRun('survey')
    abortGroup('survey')

    state.currentSurvey = null
    state.surveyLoading = true
    state.surveyError = ''
    try {
      const dto = await Api.getSurvey(surveyId)
      if (isStale('survey', run)) return
      state.currentSurvey = dto
    } catch (e: any) {
      if (isCanceledError(e)) return
      if (isStale('survey', run)) return
      state.surveyError = e?.message || String(e)
      throw e
    } finally {
      if (!isStale('survey', run)) state.surveyLoading = false
    }
  }

  async function submitSurvey(
    surveyId: string,
    body: {
      token: string
      q1: number
      q2: number
      q3: number
      q4: number
      q5: number
    },
  ) {
    await Api.submitSurveyResponses(surveyId, body)
    state.lastSubmittedSurveyId = surveyId
    toast($t('survey.thanks') || 'Danke für die Teilnahme!')
  }

  async function loadSurveyResults(surveyId: string) {
    const run = newRun('results')
    state.resultsLoading = true
    state.resultsError = ''
    try {
      const r = await Api.getSurveyResults(surveyId)
      if (isStale('results', run)) return state.results
      state.results = r
      return r
    } catch (e: any) {
      if (isCanceledError(e)) return state.results
      if (isStale('results', run)) return state.results
      state.resultsError = e?.message || String(e)
      throw e
    } finally {
      if (!isStale('results', run)) state.resultsLoading = false
    }
  }

  // --- Leader ---
  async function loadMyTeams() {
    const run = newRun('me/teams')
    state.leaderLoading = true
    state.leaderError = ''
    try {
      if (!isLoggedIn()) return ((state.myTeams = []), [])
      const teams = await Api.myTeams()
      if (isStale('me/teams', run)) return state.myTeams
      state.myTeams = teams
      return teams
    } catch (e: any) {
      if (isCanceledError(e)) return state.myTeams
      if (isStale('me/teams', run)) return state.myTeams
      state.leaderError = e?.message || String(e)
      throw e
    } finally {
      if (!isStale('me/teams', run)) state.leaderLoading = false
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
    const run = newRun('admin/teams')
    state.adminLoading = true
    state.adminError = ''
    try {
      const teams = await Api.listTeamsAdmin()
      if (isStale('admin/teams', run)) return state.teamsAdmin
      state.teamsAdmin = teams
      return teams
    } catch (e: any) {
      if (isCanceledError(e)) return state.teamsAdmin
      if (isStale('admin/teams', run)) return state.teamsAdmin
      state.adminError = e?.message || String(e)
      throw e
    } finally {
      if (!isStale('admin/teams', run)) state.adminLoading = false
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
    await Api.addMemberAdmin(teamId, userId, leader)
    toast($t('team.member_added') || 'Mitglied hinzugefügt.')
    await loadTeamsAdmin()
  }
  async function setLeaderAdmin(
    teamId: string,
    userId: string,
    leader: boolean,
  ) {
    await Api.setLeaderAdmin(teamId, userId, leader)
    toast($t('team.leader_updated') || 'Leader aktualisiert.')
    await loadTeamsAdmin()
  }
  async function removeMemberAdmin(teamId: string, userId: string) {
    await Api.removeMemberAdmin(teamId, userId)
    toast($t('team.member_removed') || 'Mitglied entfernt.')
    await loadTeamsAdmin()
  }

  function setLanguage(lang: string) {
    state.language = lang
    setI18nLocale(lang)
    try {
      sessionStorage.setItem('app.lang', lang) // 👈 nur für diese Sitzung
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
