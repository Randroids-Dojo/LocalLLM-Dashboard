/** GET /api/results — filtered run rows (macOS install-time pull + dashboard). */
import { getResults, type ResultsQuery } from '@/db/queries'
import type { RunStatus } from '@/db/schema'
import { corsJson, corsHeaders, intParam } from '@/lib/http'

export const runtime = 'nodejs'

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const q: ResultsQuery = {
    machineId: sp.get('machineId') ?? undefined,
    hardwareClass: sp.get('hardwareClass') ?? undefined,
    chipFamily: sp.get('chipFamily') ?? undefined,
    memoryTier: sp.get('memoryTier') ?? undefined,
    model: sp.get('model') ?? undefined,
    category: sp.get('category') ?? undefined,
    status: (sp.get('status') as RunStatus | null) ?? undefined,
    limit: intParam(sp.get('limit'), 50),
    offset: intParam(sp.get('offset'), 0),
    order: (sp.get('order') as ResultsQuery['order']) ?? undefined,
  }
  const res = await getResults(q)
  return corsJson(res, { cache: 's-maxage=60, stale-while-revalidate=300' })
}
