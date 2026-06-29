import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Leaderboard } from '@/lib/types'
import { pct, num } from '@/lib/types'
import { WilsonBar } from './WilsonBar'

const COLUMN_HELP = {
  rank: 'Rank in this filtered leaderboard. Models are sorted by overall score, then confidence-bound and speed tie-breakers.',
  model: 'Ollama model tag submitted with the benchmark runs. Click a model to view model-level details.',
  overall:
    'Headline score: weighted mean of category pass rates. The bar shows the estimate plus its Wilson 95% confidence interval, an uncertainty range based on the observed pass/fail sample.',
  pooled:
    'Total passing runs divided by total published runs for this model in the current leaderboard filter.',
  upm:
    'Passes per agent-minute. This is a speed view: successful runs per minute of measured agent time. It is not part of the headline score.',
  tokens:
    'Median generated tokens per second across runs where token usage data is available.',
  timeouts: 'Number of published runs that hit the task timeout.',
}

const CATEGORY_HELP: Record<string, string> = {
  'bug-fix': 'Tasks that require diagnosing and fixing existing broken behavior.',
  'feature-add': 'Tasks that require adding new behavior while preserving existing behavior.',
  'long-context': 'Tasks that require using a larger context or scattered information to solve correctly.',
  'multi-file': 'Tasks that require coordinating changes across multiple files or modules.',
  polyglot: 'Language anchor tasks across non-Python stacks such as C#, Kotlin, Swift, TypeScript, or Node.',
  refactor: 'Tasks that require restructuring code while preserving behavior.',
  'terminal-ops': 'Tasks focused on shell, file, or pipeline operations.',
  'terse-prompt': 'Tasks with intentionally brief prompts, measuring how well the model infers the needed change.',
  'test-writing': 'Tasks that require writing tests strong enough to catch regressions or mutants.',
}

function HeaderCell({
  children,
  title,
  className = 'min-w-20 px-3 py-2',
}: {
  children: ReactNode
  title: string
  className?: string
}) {
  return (
    <th className={className} title={title} aria-label={`${String(children)}: ${title}`} scope="col">
      <span className="cursor-help whitespace-nowrap decoration-dotted underline-offset-4 hover:text-neutral-300">
        {children}
      </span>
    </th>
  )
}

export function LeaderboardTable({ lb }: { lb: Leaderboard }) {
  const categories = Array.from(
    new Set(lb.ranking.flatMap((m) => Object.keys(lb.models[m]?.categories ?? {}))),
  ).sort()

  if (lb.ranking.length === 0) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
        No published results yet for this view.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
            <HeaderCell className="min-w-12 px-3 py-2" title={COLUMN_HELP.rank}>#</HeaderCell>
            <HeaderCell className="min-w-44 px-3 py-2" title={COLUMN_HELP.model}>Model</HeaderCell>
            <HeaderCell className="min-w-56 px-3 py-2" title={COLUMN_HELP.overall}>Overall (Wilson 95%)</HeaderCell>
            <HeaderCell className="min-w-24 px-3 py-2" title={COLUMN_HELP.pooled}>Pooled</HeaderCell>
            <HeaderCell className="min-w-20 px-3 py-2" title={COLUMN_HELP.upm}>UPM</HeaderCell>
            <HeaderCell className="min-w-20 px-3 py-2" title={COLUMN_HELP.tokens}>tok/s</HeaderCell>
            <HeaderCell className="min-w-16 px-3 py-2" title={COLUMN_HELP.timeouts}>TO</HeaderCell>
            {categories.map((c) => (
              <HeaderCell
                key={c}
                className="min-w-32 px-2 py-2 font-medium"
                title={CATEGORY_HELP[c] ?? `Pass rate for the ${c} benchmark category.`}
              >
                {c}
              </HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {lb.ranking.map((model, i) => {
            const s = lb.models[model]
            return (
              <tr key={model} className="border-t border-neutral-800/70 hover:bg-neutral-900/40">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{i + 1}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  <Link href={`/models/${encodeURIComponent(model)}`} className="hover:underline">
                    {model}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <WilsonBar center={s.overall} ci={s.pooled_ci} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                  {s.pooled[0]}/{s.pooled[1]}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{num(s.upm)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{num(s.median_tokens_per_sec, 1)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{s.timeouts}</td>
                {categories.map((c) => (
                  <td key={c} className="whitespace-nowrap px-2 py-2 text-neutral-400">
                    {c in s.categories ? pct(s.categories[c]) : '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
