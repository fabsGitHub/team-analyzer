// frontend/src/router.ts
import { createRouter, createWebHistory } from 'vue-router'
import AuthView from './views/AuthView.vue'
import AnalysisView from './views/AnalysisView.vue'
import TutorialView from './views/TutorialView.vue'
import EvaluationView from './views/EvaluationView.vue'

const routes = [
  { path: '/', redirect: '/auth' },
  { path: '/auth', component: AuthView },
  { path: '/tutorial', component: TutorialView },
  { path: '/evaluate', component: EvaluationView },
  { path: '/analysis', component: AnalysisView },
]
const router = createRouter({ history: createWebHistory(), routes })

router.afterEach(() => {
  setTimeout(() => document.getElementById('main')?.focus(), 0)
})

export default router
