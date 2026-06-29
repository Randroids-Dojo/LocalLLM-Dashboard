import { getLeaderboardRows, listMachines } from '@/db/queries'
import { buildLeaderboard } from '@/lib/scoring'
import { categoryWeights } from '@/lib/knownModels'
import type { Leaderboard } from '@/lib/types'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { HardwareFilterBar } from '@/components/HardwareFilterBar'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ hardwareClass?: string; suiteRunId?: string }>
}) {
  const sp = await searchParams
  const { rows } = await getLeaderboardRows(
    { hardwareClass: sp.hardwareClass },
    sp.suiteRunId,
  )
  const label = sp.hardwareClass || 'all machines'
  const lb = buildLeaderboard(rows, categoryWeights, sp.suiteRunId || 'all runs', label) as Leaderboard
  const machines = await listMachines()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Local coding-model leaderboard</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pass rates are recomputed server-side from submitted run evidence. Filter to a hardware
          class to compare models on machines like yours.
        </p>
      </div>
      <HardwareFilterBar classes={machines} />
      <LeaderboardTable lb={lb} />
      <p className="text-xs text-neutral-600">
        UPM = passes per agent-minute (speed view, not part of the headline score). TO = timeouts.
      </p>
    </div>
  )
}
