/**
 * Scoring — a faithful port of benchmarks/suite/score.py (`wilson`,
 * `aggregate`, `rank_key`, and the JSON shape of `write_leaderboard`).
 *
 * The server NEVER trusts client-supplied aggregates: it recomputes the
 * leaderboard from the per-run rows with this module, so the dashboard and the
 * macOS app render identical numbers. A vitest golden test asserts parity
 * against a real leaderboard.json.
 *
 * Porting notes that must not drift from the Python:
 *  - wilson z = 1.96; returns null for trials == 0.
 *  - median is the *upper* median: sorted[Math.floor(n / 2)].
 *  - category score = unweighted mean of its tasks' pass rates.
 *  - overall = weighted category mean; categories absent from the weights map
 *    get 0.05; weights are renormalized over categories that have data.
 *  - a row counts as a pass iff verdict === "pass".
 *  - model/task insertion order follows first-encounter in `rows`, and the
 *    rank sort is stable — together these reproduce Python's tie-breaking.
 */

export interface ScoringRow {
  model?: string | null
  task?: string | null
  category?: string | null
  verdict?: string | null
  outcome?: string | null
  agent_seconds?: number | null
  tokens_per_sec?: number | null
  turns?: number | null
  model_parameters?: string | null
  model_quant?: string | null
}

export type WilsonInterval = [number, number] | null

export interface TaskStat {
  passes: number
  trials: number
  rate: number
  ci: WilsonInterval
}

export interface ModelAggregate {
  taskStats: Record<string, TaskStat>
  categoryScores: Record<string, number>
  overall: number
  pooled: [number, number]
  pooledCi: WilsonInterval
  upm: number
  medianTps: number | null
  timeouts: number
  medianTurns: number | null
  modelParameters: string | null
  modelQuant: string | null
}

/** Port of score.py `wilson`. */
export function wilson(passes: number, trials: number, z = 1.96): WilsonInterval {
  if (trials === 0) return null
  const p = passes / trials
  const denom = 1 + (z * z) / trials
  const center = (p + (z * z) / (2 * trials)) / denom
  const half =
    (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) /
    denom
  return [Math.max(0.0, center - half), Math.min(1.0, center + half)]
}

/** Upper median, matching Python `sorted(xs)[len(xs) // 2]`. */
function upperMedian(xs: number[]): number | null {
  if (xs.length === 0) return null
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Port of score.py `aggregate`. Returns a Map in model first-encounter order. */
export function aggregate(
  rows: ScoringRow[],
  weights: Record<string, number>,
): Map<string, ModelAggregate> {
  // by model -> task -> [passes, trials]
  const byModelTask = new Map<string, Map<string, [number, number]>>()
  const taskCategory = new Map<string, string>()
  const speed = new Map<string, [number, number]>() // [passes, agent_seconds]
  const tps = new Map<string, number[]>()
  const timeouts = new Map<string, number>()
  const turns = new Map<string, number[]>()
  const modelMeta = new Map<string, { params: string | null; quant: string | null }>()

  for (const r of rows) {
    const model = r.model
    const task = r.task
    if (!model || !task) continue

    taskCategory.set(task, r.category || 'bug-fix')

    if (!byModelTask.has(model)) byModelTask.set(model, new Map())
    const tasks = byModelTask.get(model)!
    const cell = tasks.get(task) ?? [0, 0]
    cell[1] += 1
    cell[0] += r.verdict === 'pass' ? 1 : 0
    tasks.set(task, cell)

    const sp = speed.get(model) ?? [0, 0]
    sp[0] += r.verdict === 'pass' ? 1 : 0
    sp[1] += r.agent_seconds || 0
    speed.set(model, sp)

    if (r.tokens_per_sec) {
      const arr = tps.get(model) ?? []
      arr.push(r.tokens_per_sec)
      tps.set(model, arr)
    }
    if (r.outcome === 'timeout') timeouts.set(model, (timeouts.get(model) ?? 0) + 1)
    if (r.turns) {
      const arr = turns.get(model) ?? []
      arr.push(r.turns)
      turns.set(model, arr)
    }
    // record the most recent params/quant seen for the model (display only)
    modelMeta.set(model, {
      params: r.model_parameters ?? modelMeta.get(model)?.params ?? null,
      quant: r.model_quant ?? modelMeta.get(model)?.quant ?? null,
    })
  }

  const out = new Map<string, ModelAggregate>()
  for (const [model, tasks] of byModelTask) {
    const taskStats: Record<string, TaskStat> = {}
    const catRates = new Map<string, number[]>()
    let pooledPasses = 0
    let pooledTrials = 0

    // sorted(tasks.items()) — by task name
    const sortedTasks = [...tasks.keys()].sort()
    for (const task of sortedTasks) {
      const [passes, trials] = tasks.get(task)!
      const rate = trials ? passes / trials : 0.0
      taskStats[task] = { passes, trials, rate, ci: wilson(passes, trials) }
      const cat = taskCategory.get(task)!
      const arr = catRates.get(cat) ?? []
      arr.push(rate)
      catRates.set(cat, arr)
      pooledPasses += passes
      pooledTrials += trials
    }

    const categoryScores: Record<string, number> = {}
    for (const [c, v] of catRates) {
      categoryScores[c] = v.reduce((a, b) => a + b, 0) / v.length
    }

    // present = {c: w for c, w in weights if c in categoryScores}; missing -> 0.05
    const present: Record<string, number> = {}
    for (const [c, w] of Object.entries(weights)) {
      if (c in categoryScores) present[c] = w
    }
    for (const c of Object.keys(categoryScores)) {
      if (!(c in present)) present[c] = 0.05
    }
    const wsum = Object.values(present).reduce((a, b) => a + b, 0) || 1.0
    let overall = 0
    for (const [c, w] of Object.entries(present)) overall += categoryScores[c] * w
    overall /= wsum

    const [spPasses, spSecs] = speed.get(model) ?? [0, 0]
    const upm = spSecs ? spPasses / (spSecs / 60) : 0.0

    out.set(model, {
      taskStats,
      categoryScores,
      overall,
      pooled: [pooledPasses, pooledTrials],
      pooledCi: wilson(pooledPasses, pooledTrials),
      upm,
      medianTps: upperMedian(tps.get(model) ?? []),
      timeouts: timeouts.get(model) ?? 0,
      medianTurns: upperMedian(turns.get(model) ?? []),
      modelParameters: modelMeta.get(model)?.params ?? null,
      modelQuant: modelMeta.get(model)?.quant ?? null,
    })
  }
  return out
}

/** Port of score.py `rank_key`: (-overall, -pooled_ci_lower, -upm). */
export function rankKey(agg: ModelAggregate): [number, number, number] {
  const lower = agg.pooledCi ? agg.pooledCi[0] : 0.0
  return [-agg.overall, -lower, -agg.upm]
}

/** Stable rank sort over a model aggregate map, matching Python's behavior. */
export function rankModels(agg: Map<string, ModelAggregate>): string[] {
  const models = [...agg.keys()] // first-encounter order
  return models
    .map((m, i) => ({ m, i, key: rankKey(agg.get(m)!) }))
    .sort((a, b) => {
      for (let k = 0; k < 3; k++) {
        if (a.key[k] !== b.key[k]) return a.key[k] - b.key[k]
      }
      return a.i - b.i // stable
    })
    .map((x) => x.m)
}

/**
 * Build the JSON shape that score.py `write_leaderboard` emits, so the
 * dashboard and macOS app share one structure.
 */
export function buildLeaderboard(
  rows: ScoringRow[],
  weights: Record<string, number>,
  suiteLabel: string,
  machineId: string,
) {
  const agg = aggregate(rows, weights)
  const ranked = rankModels(agg)
  const models: Record<string, unknown> = {}
  for (const m of ranked) {
    const s = agg.get(m)!
    models[m] = {
      overall: s.overall,
      pooled: s.pooled,
      pooled_ci: s.pooledCi,
      upm: s.upm,
      median_tokens_per_sec: s.medianTps,
      timeouts: s.timeouts,
      median_turns: s.medianTurns,
      categories: s.categoryScores,
      tasks: Object.fromEntries(
        Object.entries(s.taskStats).map(([t, st]) => [
          t,
          { passes: st.passes, trials: st.trials, ci: st.ci },
        ]),
      ),
    }
  }
  return { suite: suiteLabel, machine_id: machineId, ranking: ranked, models }
}
