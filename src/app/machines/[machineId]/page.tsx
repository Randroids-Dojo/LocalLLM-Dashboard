import { getLeaderboardRows } from '@/db/queries'
import { buildLeaderboard } from '@/lib/scoring'
import { categoryWeights } from '@/lib/knownModels'
import type { Leaderboard } from '@/lib/types'
import { LeaderboardTable } from '@/components/LeaderboardTable'

export const dynamic = 'force-dynamic'

export default async function MachinePage({
  params,
}: {
  params: Promise<{ machineId: string }>
}) {
  const { machineId } = await params
  const id = decodeURIComponent(machineId)
  const { rows } = await getLeaderboardRows({ machineId: id })
  const lb = buildLeaderboard(rows, categoryWeights, 'all runs', id) as Leaderboard

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{id}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {rows.length} published runs on this exact machine bucket.
        </p>
      </div>
      <LeaderboardTable lb={lb} />
    </div>
  )
}
