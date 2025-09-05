import { createRouter, createWebHistory } from 'vue-router'
import AuthView from './views/AuthView.vue'
import AnalysisView from './views/AnalysisView.vue'
import TutorialView from './views/TutorialView.vue'
import EvaluationView from './views/EvaluationView.vue'
import VerifyView from './views/VerifyView.vue'

import { useStore } from './store'
import { Api } from './api/client'

const routes = [
  { path: '/', redirect: '/auth' },
  { path: '/auth', component: AuthView },
  { path: '/tutorial', component: TutorialView },
  { path: '/evaluate', component: EvaluationView },
  { path: '/analysis', component: AnalysisView },
  { path: '/verify', component: VerifyView },
  { path: '/:pathMatch(.*)*', redirect: '/evaluate' },
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
