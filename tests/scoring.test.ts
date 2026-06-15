import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildLeaderboard, type ScoringRow } from '../src/lib/scoring'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}

const rows: ScoringRow[] = fixture('rows.jsonl')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))

const suite = JSON.parse(fixture('suite.json'))
const machine = JSON.parse(fixture('machine.json'))
const expected = JSON.parse(fixture('leaderboard.json'))

const EPS = 1e-9
function closeOrNull(a: number | null, b: number | null, path: string) {
  if (a === null || b === null) {
    expect(a, path).toBe(b)
    return
  }
  expect(Math.abs(a - b), `${path} (got ${a}, want ${b})`).toBeLessThan(EPS)
}
function closeCi(a: [number, number] | null, b: [number, number] | null, path: string) {
  if (a === null || b === null) {
    expect(a, path).toBe(b)
    return
  }
  closeOrNull(a[0], b[0], `${path}[0]`)
  closeOrNull(a[1], b[1], `${path}[1]`)
}

describe('scoring parity with score.py write_leaderboard', () => {
  const built = buildLeaderboard(rows, suite.category_weights, 'bakeoff-01', machine.id) as any

  it('parses the expected number of rows', () => {
    expect(rows.length).toBe(363)
  })

  it('reproduces the ranking order exactly', () => {
    expect(built.ranking).toEqual(expected.ranking)
  })

  it('reproduces every per-model aggregate', () => {
    for (const model of expected.ranking) {
      const g = built.models[model]
      const e = expected.models[model]
      expect(g, `model ${model} present`).toBeTruthy()

      closeOrNull(g.overall, e.overall, `${model}.overall`)
      expect(g.pooled, `${model}.pooled`).toEqual(e.pooled)
      closeCi(g.pooled_ci, e.pooled_ci, `${model}.pooled_ci`)
      closeOrNull(g.upm, e.upm, `${model}.upm`)
      closeOrNull(g.median_tokens_per_sec, e.median_tokens_per_sec, `${model}.median_tokens_per_sec`)
      expect(g.timeouts, `${model}.timeouts`).toBe(e.timeouts)
      expect(g.median_turns, `${model}.median_turns`).toBe(e.median_turns)

      // categories
      expect(Object.keys(g.categories).sort()).toEqual(Object.keys(e.categories).sort())
      for (const c of Object.keys(e.categories)) {
        closeOrNull(g.categories[c], e.categories[c], `${model}.categories.${c}`)
      }

      // tasks
      expect(Object.keys(g.tasks).sort()).toEqual(Object.keys(e.tasks).sort())
      for (const t of Object.keys(e.tasks)) {
        expect(g.tasks[t].passes, `${model}.tasks.${t}.passes`).toBe(e.tasks[t].passes)
        expect(g.tasks[t].trials, `${model}.tasks.${t}.trials`).toBe(e.tasks[t].trials)
        closeCi(g.tasks[t].ci, e.tasks[t].ci, `${model}.tasks.${t}.ci`)
      }
    }
  })
})
