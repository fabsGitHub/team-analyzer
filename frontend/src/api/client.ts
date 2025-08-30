// frontend/src/api/client.ts
// Unified API with mock mode. In step 1 we DO NOT call network, but log empty HTTP intents.
import type { Evaluation } from '../types'
type Mode = 'mock' | 'real'
const apiBase = '/api'
const mode: Mode = 'mock' // switch to "real" in step 2

async function empty(method: string, url: string, body?: unknown) {
  console.debug(`[MOCK ${method}]`, url, body ?? null)
  await new Promise((r) => setTimeout(r, 120)) // simulate latency
  return { ok: true }
}

export const Api = {
  async listEvaluations(): Promise<Evaluation[]> {
    if (mode === 'mock') {
      await empty('GET', `${apiBase}/evaluations`)
      return []
    }
    const r = await fetch(`${apiBase}/evaluations`)
    return r.json()
  },
  async createEvaluation(e: Evaluation) {
    return mode === 'mock'
      ? empty('POST', `${apiBase}/evaluations`, e)
      : fetch(`${apiBase}/evaluations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e),
        })
  },
  async updateEvaluation(id: string, e: Partial<Evaluation>) {
    return mode === 'mock'
      ? empty('PUT', `${apiBase}/evaluations/${id}`, e)
      : fetch(`${apiBase}/evaluations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e),
        })
  },
  async deleteEvaluation(id: string) {
    return mode === 'mock'
      ? empty('DELETE', `${apiBase}/evaluations/${id}`)
      : fetch(`${apiBase}/evaluations/${id}`, { method: 'DELETE' })
  },
  // auth mock
  async signIn(name: string) {
    console.debug('[MOCK POST] /auth/login', { name })
    return { token: `mock.${btoa(name)}.token` }
  },
}
