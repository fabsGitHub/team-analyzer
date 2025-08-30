import type { Evaluation, TeamAggregate } from '../types'
export function aggregateByTeam(evals: Evaluation[]): TeamAggregate[] {
  const map = new Map<string, { sum: Record<string, number>; n: number }>()
  const keys = [
    'appreciation',
    'equality',
    'workload',
    'collegiality',
    'transparency',
  ]
  for (const e of evals) {
    if (!map.has(e.team)) map.set(e.team, { sum: {}, n: 0 } as any)
    const m = map.get(e.team)!
    m.n++
    for (const k of keys) m.sum[k] = (m.sum[k] || 0) + (e as any)[k]
  }
  const out: TeamAggregate[] = []
  for (const [team, { sum, n }] of map.entries()) {
    const averages: any = {}
    for (const k of keys) averages[k] = +(sum[k] / n).toFixed(2)
    out.push({ team, count: n, averages })
  }
  return out
}
