// ─── Database types (mirrors Supabase schema v2 — multi-pool) ─────────────────

export type MemberRole = 'admin' | 'member'
export type MemberStatus = 'pending' | 'approved' | 'rejected'
export type Phase =
  | 'grupos'
  | '32avos'
  | 'octavos'
  | 'cuartos'
  | 'semis'
  | '3er'
  | 'final'

export interface AppUser {
  id: string
  username: string
  created_at: string
}

export interface Pool {
  id: string
  name: string
  invite_code: string
  created_by: string
  require_approval: boolean
  created_at: string
}

export interface PoolMember {
  id: string
  pool_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  locked_matches: boolean
  locked_spain: boolean
  locked_awards: boolean
  joined_at: string
  // joined data (optional, populated by queries)
  username?: string
}

export interface Match {
  id: string
  match_number: number
  jornada: number | null
  home_team: string
  away_team: string
  match_date: string
  competition: string
  season: string
  round: string | null
  leg: string | null
  // Legacy fields (for compatibility)
  group_name?: string | null
  home?: string
  away?: string
  date?: string
  phase?: Phase
  pts_exact?: number
  pts_winner?: number
  is_bonus?: boolean
}

export interface PoolMatchTeams {
  id: string
  pool_id: string
  match_id: string
  real_home: string | null
  real_away: string | null
}

export interface Result {
  id: string
  pool_id: string
  match_id: string
  home_score: number
  away_score: number
  source: 'manual' | 'api'
  updated_at: string
}

export interface Prediction {
  id: string
  pool_id: string
  user_id: string
  match_id: string
  home_score: number
  away_score: number
  created_at: string
}

export interface AwardPrediction {
  id: string
  pool_id: string
  user_id: string
  award_id: string
  value: string
  created_at: string
}

export interface AwardResult {
  id: string
  award_id: string
  value: string
  updated_at: string
}

export interface SpainPrediction {
  id: string
  pool_id: string
  user_id: string
  field_id: string
  value: string
  created_at: string
}

export interface SpainResult {
  id: string
  field_id: string
  value: string
  updated_at: string
}

export interface PlatformAdmin {
  id: string
  created_at: string
}

export interface PoolOpenPhase {
  id: string
  pool_id: string
  phase: Phase
  is_open: boolean
  updated_at: string
}

export interface PoolSpainSquadPlayer {
  id: string
  pool_id: string
  name: string
}

// ─── App types ────────────────────────────────────────────────────────────────

export interface UserScore {
  userId: string
  username: string
  role: MemberRole
  matchPoints: number
  spainPoints: number
  awardPoints: number
  total: number
  lockedMatches: boolean
  lockedSpain: boolean
  lockedAwards: boolean
}

export interface Award {
  id: string
  label: string
  icon: string
  desc: string
  pts: number
  type: 'player' | 'team' | 'coach'
}

export interface SpainField {
  id: string
  label: string
  desc: string
  pts: number
  type: 'player' | 'select' | 'number'
  options?: string[]
}

export interface ScoreBreakdown {
  matchPoints: number
  spainPoints: number
  awardPoints: number
  total: number
}
