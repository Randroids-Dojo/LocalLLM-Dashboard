import Link from 'next/link'
import type { Leaderboard } from '@/lib/types'
import { pct, num } from '@/lib/types'
import { WilsonBar } from './WilsonBar'

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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Overall (Wilson 95%)</th>
            <th className="px-3 py-2">Pooled</th>
            <th className="px-3 py-2">UPM</th>
            <th className="px-3 py-2">tok/s</th>
            <th className="px-3 py-2">TO</th>
            {categories.map((c) => (
              <th key={c} className="px-2 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lb.ranking.map((model, i) => {
            const s = lb.models[model]
            return (
              <tr key={model} className="border-t border-neutral-800/70 hover:bg-neutral-900/40">
                <td className="px-3 py-2 text-neutral-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/models/${encodeURIComponent(model)}`} className="hover:underline">
                    {model}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <WilsonBar center={s.overall} ci={s.pooled_ci} />
                </td>
                <td className="px-3 py-2 text-neutral-300">
                  {s.pooled[0]}/{s.pooled[1]}
                </td>
                <td className="px-3 py-2 text-neutral-300">{num(s.upm)}</td>
                <td className="px-3 py-2 text-neutral-300">{num(s.median_tokens_per_sec, 1)}</td>
                <td className="px-3 py-2 text-neutral-300">{s.timeouts}</td>
                {categories.map((c) => (
                  <td key={c} className="px-2 py-2 text-neutral-400">
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
