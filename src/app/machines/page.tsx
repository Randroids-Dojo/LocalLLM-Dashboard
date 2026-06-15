import Link from 'next/link'
import { listMachines } from '@/db/queries'

export const dynamic = 'force-dynamic'

export default async function MachinesPage() {
  const machines = await listMachines()
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Machines</h1>
      {machines.length === 0 ? (
        <p className="text-sm text-neutral-400">No machines have submitted results yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => (
            <Link
              key={m.machineId}
              href={`/machines/${encodeURIComponent(m.machineId)}`}
              className="rounded border border-neutral-800 bg-neutral-900/40 p-4 hover:border-neutral-700"
            >
              <div className="font-medium">{m.chip}</div>
              <div className="text-sm text-neutral-400">
                {m.modelName ?? 'Mac'} · {m.memoryGb ?? '?'} GB · {m.cpuCores ?? '?'} cores
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                {m.runCount} runs · class <code className="text-neutral-400">{m.hardwareClass}</code>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
