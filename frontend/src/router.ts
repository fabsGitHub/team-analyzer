import { createRouter, createWebHistory } from 'vue-router'
import AuthView from './views/AuthView.vue'
import TutorialView from './views/TutorialView.vue'
import VerifyView from './views/VerifyView.vue'

import { useStore } from './store'
import { Api } from './api/client'
import ImprintView from './footer/ImprintView.vue'
import PrivacyView from './footer/PrivacyView.vue'
import HelpView from './footer/HelpView.vue'
import ShortcutsView from './footer/ShortcutsView.vue'
import AboutView from './footer/AboutView.vue'
import SurveyView from './views/SurveyView.vue'
import SurveyManageView from './views/SurveyManageView.vue'
import AdminTeamView from './views/AdminTeamView.vue'
import MyTokensView from './views/MyTokensView.vue'

const routes = [
  { path: '/', redirect: '/auth' },
  { path: '/auth', component: AuthView },
  { path: '/tutorial', component: TutorialView },
  { path: '/verify', component: VerifyView },
  { path: '/imprint', component: ImprintView },
  { path: '/privacy', component: PrivacyView },
  { path: '/help', component: HelpView },
  { path: '/shortcuts', component: ShortcutsView },
  { path: '/about', component: AboutView },
  { path: '/:pathMatch(.*)*', redirect: '/evaluate' },
  {
    path: '/surveys/:id',
    name: 'Survey',
    component: SurveyView,
  },
  {
    path: '/my/tokens',
    name: 'MyToken',
    component: MyTokensView,
  },
  {
    path: '/leader/surveys',
    name: 'SurveyManage',
    component: SurveyManageView,
    meta: { requiresRole: ['leader'] },
  },
  {
    path: '/surveys',
    name: 'SurveyList',
    component: () => import('@/views/SurveyListView.vue'),
    meta: { requiresRole: ['leader'] },
  },
  {
    path: '/admin/teams',
    name: 'TeamAdmin',
    component: AdminTeamView,
    meta: { requiresRole: ['admin'] },
  },
  // src/router/index.ts
  {
    path: '/surveys/:id/results',
    name: 'survey-results',
    component: () => import('@/views/SurveyResultsView.vue'),
  },
]

const router = createRouter({ history: createWebHistory(), routes })

const PUBLIC_PATHS = new Set<string>(['/auth', '/verify', '/surveys/:id'])

// kleine Helfer – NUR Rollen verwenden
function hasRole(user: any, role: 'admin' | 'leader') {
  if (!user) return false
  const roles: string[] = Array.isArray(user.roles) ? user.roles : []
  const isAdmin = roles.includes('ROLE_ADMIN')

  if (role === 'admin') return isAdmin
  if (role === 'leader') return roles.includes('ROLE_LEADER') || isAdmin
  return false
}

// Guard: Session herstellen + Rollen erzwingen
router.beforeEach(async (to) => {
  const store = useStore()

  if (PUBLIC_PATHS.has(to.path)) return true

  if (!store.state.user) {
    try {
      const me = await Api.me()
      store.setUser(me)
    } catch {
      return { path: '/auth', query: { redirect: to.fullPath } }
    }
  }

  const required = (to.meta as any)?.requiresRole as string[] | undefined
  if (required?.length) {
    const u = store.state.user
    const ok = required.every((r) => hasRole(u, r as any))
    if (!ok) {
      // immer hierhin umlenken, wie gewünscht
      // optional: Grund anhängen (erste fehlende Rolle)
      const need = required.find((r) => !hasRole(u, r as any))
      return { path: '/my/tokens', query: { denied: need ?? 'forbidden' } }
    }
  }

  return true
})

router.afterEach(() => {
  setTimeout(() => document.getElementById('main')?.focus(), 0)
})

export default router
