/**
 * Typed read queries shared by route handlers and server components.
 * Fuzzy hardware matching resolves a hardware class to a set of machine_ids,
 * then filters runs by that set.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from './client'
import { machines, runs } from './schema'
import type { RunStatus } from './schema'
import { hardwareClass as deriveClass } from '@/lib/fingerprint'
import type { ScoringRow } from '@/lib/scoring'

export interface MachineFilter {
  machineId?: string
  hardwareClass?: string
  chipFamily?: string
  memoryTier?: string
}

/** Resolve a filter to concrete machine_ids. Empty array = "all machines". */
export async function resolveMachineIds(f: MachineFilter): Promise<string[] | null> {
  const db = getDb()
  if (f.machineId) return [f.machineId]
  let hwClass = f.hardwareClass
  if (!hwClass && f.chipFamily && f.memoryTier) hwClass = `${f.chipFamily}__${f.memoryTier}`
  if (hwClass) {
    const rows = await db
      .select({ id: machines.machineId })
      .from(machines)
      .where(eq(machines.hardwareClass, hwClass))
    return rows.map((r) => r.id)
  }
  return null // no machine filter -> all
}

export interface ResultsQuery extends MachineFilter {
  model?: string
  category?: string
  status?: RunStatus
  limit?: number
  offset?: number
  order?: 'tokensPerSec' | 'recent' | 'pass'
}

export async function getResults(q: ResultsQuery) {
  const db = getDb()
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 100)
  const offset = Math.max(q.offset ?? 0, 0)
  const status: RunStatus = q.status ?? 'published'

  const machineIds = await resolveMachineIds(q)
  if (machineIds !== null && machineIds.length === 0) {
    return { results: [], pagination: { limit, offset, total: 0 }, resolvedMachines: [] }
  }

  const conds = [eq(runs.status, status)]
  if (machineIds !== null) conds.push(inArray(runs.machineId, machineIds))
  if (q.model) conds.push(eq(runs.model, q.model))
  if (q.category) conds.push(eq(runs.category, q.category))

  const orderBy =
    q.order === 'tokensPerSec'
      ? desc(runs.tokensPerSec)
      : q.order === 'pass'
        ? desc(runs.pass)
        : desc(runs.runTimestamp)

  const rows = await db
    .select()
    .from(runs)
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)

  const totalRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(runs)
    .where(and(...conds))
  const total = totalRow[0]?.n ?? 0

  return {
    results: rows,
    pagination: { limit, offset, total },
    resolvedMachines: machineIds ?? 'all',
  }
}

/** Fetch published runs for a machine set as ScoringRow[] for aggregation. */
export async function getLeaderboardRows(
  f: MachineFilter,
  suiteRunId?: string,
): Promise<{ rows: ScoringRow[]; machineIds: string[] | null }> {
  const db = getDb()
  const machineIds = await resolveMachineIds(f)
  if (machineIds !== null && machineIds.length === 0) return { rows: [], machineIds }

  const conds = [eq(runs.status, 'published' as RunStatus)]
  if (machineIds !== null) conds.push(inArray(runs.machineId, machineIds))
  if (suiteRunId) conds.push(eq(runs.suiteRunId, suiteRunId))

  const rows = await db
    .select({
      model: runs.model,
      task: runs.task,
      category: runs.category,
      verdict: runs.verdict,
      outcome: runs.outcome,
      agent_seconds: runs.agentSeconds,
      tokens_per_sec: runs.tokensPerSec,
      turns: runs.turns,
      model_parameters: runs.modelParameters,
      model_quant: runs.modelQuant,
    })
    .from(runs)
    .where(and(...conds))

  return { rows, machineIds }
}

/** Machine-class index for the filter UI, ordered by run volume. */
export async function listMachines() {
  const db = getDb()
  return db
    .select({
      machineId: machines.machineId,
      chip: machines.chip,
      chipFamily: machines.chipFamily,
      memoryTier: machines.memoryTier,
      memoryGb: machines.memoryGb,
      cpuCores: machines.cpuCores,
      modelName: machines.modelName,
      hardwareClass: machines.hardwareClass,
      runCount: machines.runCount,
      submissionCount: machines.submissionCount,
    })
    .from(machines)
    .orderBy(desc(machines.runCount))
}

export { deriveClass }
