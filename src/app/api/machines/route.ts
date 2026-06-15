/** GET /api/machines — machine-class index for the filter UI. */
import { listMachines } from '@/db/queries'
import { corsJson, corsHeaders } from '@/lib/http'

export const runtime = 'nodejs'

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET() {
  const machines = await listMachines()
  return corsJson({ machines }, { cache: 's-maxage=300, stale-while-revalidate=900' })
}
