/** GET /api/leaderboard — aggregated per-model scores (same shape as the app's
 * leaderboard.json), computed server-side from published runs. */
import { getLeaderboardRows, type MachineFilter } from '@/db/queries'
import { buildLeaderboard } from '@/lib/scoring'
import { categoryWeights } from '@/lib/knownModels'
import { corsJson, corsHeaders } from '@/lib/http'

export const runtime = 'nodejs'

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const filter: MachineFilter = {
    machineId: sp.get('machineId') ?? undefined,
    hardwareClass: sp.get('hardwareClass') ?? undefined,
    chipFamily: sp.get('chipFamily') ?? undefined,
    memoryTier: sp.get('memoryTier') ?? undefined,
  }
  const suiteRunId = sp.get('suiteRunId') ?? undefined
  const { rows, machineIds } = await getLeaderboardRows(filter, suiteRunId)
  const label = sp.get('machineId') || sp.get('hardwareClass') || 'all machines'
  const lb = buildLeaderboard(rows, categoryWeights, suiteRunId || 'all runs', label)
  return corsJson(
    { ...lb, resolvedMachines: machineIds ?? 'all' },
    { cache: 's-maxage=120, stale-while-revalidate=600' },
  )
}
