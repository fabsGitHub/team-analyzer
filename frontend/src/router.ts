// router.ts
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

  // /auth: wenn Session automatisch möglich -> direkt /my/tokens
  {
    path: '/auth',
    component: AuthView,
    beforeEnter: async () => {
      const store = useStore()
      const hasSession = await Api.prewarmSession()
      if (!hasSession) return true
      if (!store.state.user) {
        try {
          const me = await Api.me()
          store.setUser(me as any)
        } catch {
          return true
        }
      }
      return { path: '/my/tokens' }
    },
  },

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
  {
    path: '/surveys/:id/results',
    name: 'survey-results',
    component: () => import('@/views/SurveyResultsView.vue'),
  },
]

const router = createRouter({ history: createWebHistory(), routes })

const PUBLIC_PATHS = new Set<string>([
  '/auth',
  '/verify',
  '/imprint',
  '/privacy',
  '/help',
  '/shortcuts',
  '/about',
])

function hasRole(user: any, role: 'admin' | 'leader') {
  if (!user) return false
  const roles: string[] = Array.isArray(user.roles) ? user.roles : []
  const isAdmin = roles.includes('ROLE_ADMIN')
  if (role === 'admin') return isAdmin
  if (role === 'leader') return roles.includes('ROLE_LEADER') || isAdmin
  return false
}

// Survey ist "public", wenn ein Token im Query hängt
function isPublicSurveyRoute(to: any) {
  return (
    to.name === 'Survey' &&
    typeof to.query?.token === 'string' &&
    to.query.token.length > 0
  )
}

// Globaler Guard
router.beforeEach(async (to) => {
  const store = useStore()

  // 1) Survey mit Token: IMMER anzeigen, kein Login-Zwang.
  if (isPublicSurveyRoute(to)) {
    // Best effort: stiller Auto-Login im Hintergrund, aber niemals blockieren.
    Api.prewarmSession()
      .then(async (ok) => {
        if (ok && !store.state.user) {
          try {
            const me = await Api.me()
            store.setUser(me as any)
          } catch {
            /* ignore – Survey bleibt sichtbar */
          }
        }
      })
      .catch(() => {})
    return true
  }

  // 2) Statische Public Pages: durchlassen, nur anonymes /me probieren
  if (PUBLIC_PATHS.has(to.path)) {
    Api.meAnonymousOk().catch(() => {})
    return true
  }

  // 3) Geschützte Bereiche: nur wenn Auto-Login klappt, dann einloggen; sonst zur /auth
  if (!store.state.user) {
    const hasSession = await Api.prewarmSession()
    if (!hasSession) {
      return { path: '/auth', query: { redirect: to.fullPath } }
    }
    try {
      const me = await Api.me()
      store.setUser(me as any)
    } catch {
      return { path: '/auth', query: { redirect: to.fullPath } }
    }
  }

  // 4) Rollenpflicht (Leader/Admin)
  const required = (to.meta as any)?.requiresRole as string[] | undefined
  if (required?.length) {
    const u = store.state.user
    const ok = required.every((r) => hasRole(u, r as any))
    if (!ok) {
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
