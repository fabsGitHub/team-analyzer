export type TeamId = string

export interface SurveyQuestion {
  id: string
  idx: number
  text: string
}
export interface SurveyDto {
  id: string
  title: string
  questions: SurveyQuestion[]
}
export interface SubmitSurveyRequest {
  token: string
  q1: number
  q2: number
  q3: number
  q4: number
  q5: number
}
export interface SurveyResultsDto {
  q1: number
  q2: number
  q3: number
  q4: number
  q5: number
  responses: number
}
export interface CreateSurveyRequest {
  teamId: string
  title: string
  questions: [string, string, string, string, string]
}
export interface TeamLite {
  id: string
  name: string
}
export interface TeamMemberDto {
  userId: string
  leader: boolean
}
export interface TeamAdminDto extends TeamLite {
  members: TeamMemberDto[]
}

// falls noch nicht vorhanden:
export interface Toast {
  id: string
  text: string
  type?: 'success' | 'danger' | 'info' | 'warning'
}

export type Role = 'USER' | 'ROLE_ADMIN' | 'ROLE_TEAM_LEADER'

export const Roles = {
  ADMIN: 'ROLE_ADMIN',
  TEAM_LEADER: 'ROLE_TEAM_LEADER',
  USER: 'USER'
} as const