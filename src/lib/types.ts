/** Shared view types for the leaderboard JSON shape (from buildLeaderboard). */
export interface LeaderboardModel {
  overall: number
  pooled: [number, number]
  pooled_ci: [number, number] | null
  upm: number
  median_tokens_per_sec: number | null
  timeouts: number
  median_turns: number | null
  categories: Record<string, number>
  tasks: Record<string, { passes: number; trials: number; ci: [number, number] | null }>
}

export interface Leaderboard {
  suite: string
  machine_id: string
  ranking: string[]
  models: Record<string, LeaderboardModel>
}

export function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return '—'
  return `${Math.round(x * 100)}%`
}

export function num(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined) return '—'
  return x.toFixed(digits)
}
