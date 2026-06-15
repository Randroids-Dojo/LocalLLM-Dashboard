import Link from 'next/link'
import { getResults } from '@/db/queries'
import { buildLeaderboard, type ScoringRow } from '@/lib/scoring'
import { categoryWeights } from '@/lib/knownModels'
import type { Leaderboard } from '@/lib/types'
import { pct, num } from '@/lib/types'
import { WilsonBar } from '@/components/WilsonBar'

export const dynamic = 'force-dynamic'

export default async function ModelPage({ params }: { params: Promise<{ model: string }> }) {
  const { model } = await params
  const name = decodeURIComponent(model)
  const { results } = await getResults({ model: name, limit: 100, order: 'recent' })

  const rows: ScoringRow[] = results.map((r) => ({
    model: r.model,
    task: r.task,
    category: r.category,
    verdict: r.verdict,
    outcome: r.outcome,
    agent_seconds: r.agentSeconds,
    tokens_per_sec: r.tokensPerSec,
    turns: r.turns,
    model_parameters: r.modelParameters,
    model_quant: r.modelQuant,
  }))

  const lb = buildLeaderboard(rows, categoryWeights, 'all runs', name) as Leaderboard
  const s = lb.models[name]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Leaderboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{name}</h1>
        {s && (
          <p className="mt-1 text-sm text-neutral-400">
            Overall {pct(s.overall)} · pooled {s.pooled[0]}/{s.pooled[1]} · median{' '}
            {num(s.median_tokens_per_sec, 1)} tok/s · {s.timeouts} timeouts
            {results.length === 100 && ' · showing the 100 most recent runs'}
          </p>
        )}
      </div>

      {!s ? (
        <p className="text-sm text-neutral-400">No published runs for this model.</p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Category scores
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(s.categories)
                .sort()
                .map(([c, v]) => (
                  <div
                    key={c}
                    className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm"
                  >
                    <span className="text-neutral-300">{c}</span>
                    <span className="font-medium">{pct(v)}</span>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Per-task pass rate (Wilson 95%)
            </h2>
            <div className="space-y-2">
              {Object.entries(s.tasks)
                .sort()
                .map(([t, st]) => (
                  <div key={t} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate text-neutral-300">{t}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500">
                        {st.passes}/{st.trials}
                      </span>
                      <WilsonBar center={st.trials ? st.passes / st.trials : 0} ci={st.ci} />
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
