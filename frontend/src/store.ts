// frontend/src/store.ts
import { reactive, computed } from 'vue'
import {
  CATEGORY_KEYS,
  type CategoryKey,
  type Evaluation,
  type TeamAggregate,
} from './types'
import { Api } from './api/client'
import { seed } from './fixtures/demo'

function uuid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

const state = reactive({
  token: '' as string,
  evaluations: [] as Evaluation[],
  teams: ['Team 1', 'Team 2', 'Team 3'] as string[],
  toasts: [] as { id: string; text: string }[],
  loading: false,
  error: '' as string,
})

export const useStore = () => {
  async function init() {
    state.loading = true
    try {
      await Api.listEvaluations() // mock GET
      state.evaluations = [...seed] // local demo
    } finally {
      state.loading = false
    }
  }
  function toast(text: string) {
    const id = uuid()
    state.toasts.push({ id, text })
    setTimeout(() => dismiss(id), 2500)
  }
  function dismiss(id: string) {
    state.toasts = state.toasts.filter((t) => t.id !== id)
  }

  function addEvaluation(
    input: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const now = new Date().toISOString()
    const e: Evaluation = {
      id: uuid(),
      createdAt: now,
      updatedAt: now,
      ...input,
    }
    state.evaluations.unshift(e)
    Api.createEvaluation(e)
    toast($t('toast.saved'))
  }
  function updateEvaluation(id: string, patch: Partial<Evaluation>) {
    const idx = state.evaluations.findIndex((e) => e.id === id)
    if (idx < 0) return
    state.evaluations[idx] = {
      ...state.evaluations[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    Api.updateEvaluation(id, patch)
    toast($t('toast.updated'))
  }
  function deleteEvaluation(id: string) {
    state.evaluations = state.evaluations.filter((e) => e.id !== id)
    Api.deleteEvaluation(id)
    toast($t('toast.deleted'))
  }

  const aggregates = computed<TeamAggregate[]>(() => {
    const byTeam = new Map<string, Evaluation[]>()
    for (const e of state.evaluations) {
      if (!byTeam.has(e.team)) byTeam.set(e.team, [])
      byTeam.get(e.team)!.push(e)
    }
    const out: TeamAggregate[] = []
    for (const [team, arr] of byTeam) {
      const sums: Record<CategoryKey, number> = {
        appreciation: 0,
        equality: 0,
        workload: 0,
        collegiality: 0,
        transparency: 0,
      }
      arr.forEach((e) => CATEGORY_KEYS.forEach((k) => (sums[k] += e[k])))
      const avg = Object.fromEntries(
        CATEGORY_KEYS.map((k) => [k, +(sums[k] / arr.length).toFixed(2)]),
      ) as any
      out.push({ team, count: arr.length, averages: avg })
    }
    return out.sort((a, b) => a.team.localeCompare(b.team))
  })

  function setToken(t: string) {
    state.token = t
  }

  return {
    state,
    init,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation,
    aggregates,
    setToken,
    toast,
    dismiss,
  }
}

// lightweight i18n access inside store
import { i18n } from './i18n'
function $t(key: string) {
  return (i18n.global as any).t(key) as string
}
