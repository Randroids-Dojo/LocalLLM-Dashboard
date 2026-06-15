'use client'

import { useCallback, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'

interface RunRow {
  id: string
  runName: string
  model: string
  task: string
  status: string
  flagReasons: string[]
  machineId: string
}

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'flagged' | 'published' | 'revoked'>('flagged')
  const [rows, setRows] = useState<RunRow[]>([])
  const [msg, setMsg] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (status = statusFilter) => {
      setBusy(true)
      setMsg('')
      try {
        const res = await fetch(`/api/results?status=${status}&limit=100`)
        const data = await res.json()
        setRows(data.results ?? [])
        setAuthed(true)
      } catch {
        setMsg('Failed to load results.')
      } finally {
        setBusy(false)
      }
    },
    [statusFilter],
  )

  async function act(run: RunRow, action: 'flag' | 'unflag' | 'revoke') {
    const reason = window.prompt(`Reason for ${action} on ${run.model} / ${run.task}?`)
    if (!reason) return
    const body: Record<string, string> = {
      action,
      targetType: 'run',
      targetId: run.id,
      reason,
    }
    if (action === 'revoke') body.confirm = 'revoke benchmark result'
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg(`Error: ${data.error ?? res.status}`)
      } else {
        setMsg(`${action} ok (${run.runName})`)
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Admin · result curation</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Admin Bearer token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="DASHBOARD_ADMIN_TOKEN"
            className="w-72 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
        >
          <option value="flagged">flagged</option>
          <option value="published">published</option>
          <option value="revoked">revoked</option>
        </select>
        <button
          onClick={() => load()}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Load'}
        </button>
        {msg && <span className="text-sm text-neutral-400">{msg}</span>}
      </div>

      {authed && (
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-neutral-500">
                    No {statusFilter} runs.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800/70">
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.model}</td>
                  <td className="px-3 py-2 text-neutral-400">{r.task}</td>
                  <td className="px-3 py-2 text-amber-400/80">{r.flagReasons?.join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-neutral-500">{r.machineId}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {r.status !== 'flagged' && (
                        <button onClick={() => act(r, 'flag')} className="text-amber-400 hover:underline">
                          flag
                        </button>
                      )}
                      {r.status !== 'published' && (
                        <button onClick={() => act(r, 'unflag')} className="text-emerald-400 hover:underline">
                          unflag
                        </button>
                      )}
                      {r.status !== 'revoked' && (
                        <button onClick={() => act(r, 'revoke')} className="text-red-400 hover:underline">
                          revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-600">
        The token is held only in this tab&apos;s memory and sent as a Bearer header to{' '}
        <code>/api/admin/results</code>. Revoke requires a reason; it hides results without deleting
        them (reversible, audited).
      </p>
    </div>
  )
}
