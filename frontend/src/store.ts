// src/store.ts
import { reactive } from 'vue'
import { Api, useAuthToken } from '@/api/client'
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

interface State {
  token: string
  user: { email: string; roles: string[], id?: string, isLeader?: boolean } | null
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

useAuthToken(
  () => state.token,
  (t) => (state.token = t),
)

export const useStore = (): StoreApi => {
  // --- Auth ---
  function setUser(u: { email: string; roles: string[] } | null) {
    state.user = u
  }
  async function init() {
    state.loading = true
    state.error = ''
    try {
      if (!state.user) {
        try {
          state.user = await Api.me()
        } catch {
          /* guest */
        }
      }
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
    state.currentSurvey = null
    state.surveyLoading = true
    state.surveyError = ''
    try {
      state.currentSurvey = await Api.getSurvey(surveyId)
    } catch (e: any) {
      state.surveyError = e?.message || String(e)
      throw e
    } finally {
      state.surveyLoading = false
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
    state.resultsLoading = true
    state.resultsError = ''
    try {
      state.results = await Api.getSurveyResults(surveyId)
      return state.results
    } catch (e: any) {
      state.resultsError = e?.message || String(e)
      throw e
    } finally {
      state.resultsLoading = false
    }
  }

  // --- Leader ---
  async function loadMyTeams() {
    state.leaderLoading = true
    state.leaderError = ''
    try {
      if (!isLoggedIn()) return ((state.myTeams = []), [])
      state.myTeams = await Api.myTeams()
      return state.myTeams
    } catch (e: any) {
      state.leaderError = e?.message || String(e)
      throw e
    } finally {
      state.leaderLoading = false
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
    state.adminLoading = true
    state.adminError = ''
    try {
      state.teamsAdmin = await Api.listTeamsAdmin()
      return state.teamsAdmin
    } catch (e: any) {
      state.adminError = e?.message || String(e)
      throw e
    } finally {
      state.adminLoading = false
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
    dismiss, // <— EXPLIZIT im Typ & im Return
  }
}
