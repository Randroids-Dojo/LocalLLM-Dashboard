import { pct } from '@/lib/types'

/** A compact Wilson-interval bar: the CI band with the point estimate marked. */
export function WilsonBar({
  center,
  ci,
}: {
  center: number
  ci: [number, number] | null
}) {
  const lo = ci ? ci[0] : center
  const hi = ci ? ci[1] : center
  return (
    <div className="w-40">
      <div className="relative h-2 rounded bg-neutral-800">
        <div
          className="absolute h-2 rounded bg-emerald-700/60"
          style={{ left: `${lo * 100}%`, width: `${Math.max(0, (hi - lo) * 100)}%` }}
        />
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-emerald-300"
          style={{ left: `${center * 100}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500">
        {pct(center)} <span className="text-neutral-600">[{pct(lo)}–{pct(hi)}]</span>
      </div>
    </div>
  )
}
