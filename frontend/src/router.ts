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
    path: '/leader/surveys',
    name: 'SurveyManage',
    component: SurveyManageView,
    meta: { requiresRole: ['leader', 'admin'] },
  },
  {
    path: '/admin/teams',
    name: 'TeamAdmin',
    component: AdminTeamView,
    meta: { requiresRole: ['admin'] },
  },
]

const router = createRouter({ history: createWebHistory(), routes })

// Public pages
const PUBLIC_PATHS = new Set<string>(['/auth', '/verify'])

// Guard: protect all but public paths; recover session via /me once
router.beforeEach(async (to) => {
  const store = useStore()

  if (PUBLIC_PATHS.has(to.path)) return true
  if (store.state.user) return true

  try {
    const me = await Api.me() // interceptor will refresh if possible
    store.setUser(me)
    return true
  } catch {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
})

router.afterEach(() => {
  setTimeout(() => document.getElementById('main')?.focus(), 0)
})

export default router
