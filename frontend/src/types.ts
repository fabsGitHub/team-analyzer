// frontend/src/types.ts
export type CategoryKey =
  | 'appreciation'
  | 'equality'
  | 'workload'
  | 'collegiality'
  | 'transparency'
export const CATEGORY_KEYS: CategoryKey[] = [
  'appreciation',
  'equality',
  'workload',
  'collegiality',
  'transparency',
]
export type TeamId = string
export interface Evaluation {
  id: String
  name: string
  team: TeamId
  appreciation: number
  equality: number
  workload: number
  collegiality: number
  transparency: number
  createdAt: string
  updatedAt: string
}
export interface TeamAggregate {
  team: TeamId
  count: number
  averages: Record<CategoryKey, number>
}

// Example state definition
export interface Toast {
    id: string;
    text: string;
    type?: string;
}