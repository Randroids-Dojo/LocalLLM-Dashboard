'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export interface MachineClass {
  hardwareClass: string
  chip: string
  memoryTier: string
  runCount: number
}

/** Client filter: writes the selected hardware class into the URL search params
 * so the server component re-renders (shareable, RSC-native filtering). */
export function HardwareFilterBar({ classes }: { classes: MachineClass[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('hardwareClass') ?? ''

  // de-dupe by hardwareClass, summing run counts
  const byClass = new Map<string, MachineClass>()
  for (const c of classes) {
    const prev = byClass.get(c.hardwareClass)
    if (prev) prev.runCount += c.runCount
    else byClass.set(c.hardwareClass, { ...c })
  }
  const options = [...byClass.values()].sort((a, b) => b.runCount - a.runCount)

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    const next = new URLSearchParams(Array.from(params.entries()))
    if (v) next.set('hardwareClass', v)
    else next.delete('hardwareClass')
    router.push(`?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-neutral-400">Hardware class</label>
      <select
        value={current}
        onChange={onChange}
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
      >
        <option value="">All machines</option>
        {options.map((c) => (
          <option key={c.hardwareClass} value={c.hardwareClass}>
            {c.chip} · {c.memoryTier} ({c.runCount})
          </option>
        ))}
      </select>
    </div>
  )
}
