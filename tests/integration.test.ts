import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '../src/db/schema'
import { __setTestDb } from '../src/db/client'

function fx(p: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${p}`, import.meta.url)), 'utf8')
}
function b64gz(text: string): string {
  return gzipSync(Buffer.from(text, 'utf8')).toString('base64')
}

const machine = JSON.parse(fx('machine.json'))
const report = JSON.parse(fx('run-pass/report.json'))
const eventsGz = b64gz(fx('run-pass/events.log'))
const testGz = b64gz(fx('run-pass/test-output.txt'))

function submissionBody() {
  // strip the artifacts blob + non-contract keys; attach gzipped evidence
  const { artifacts: _a, machine_id: _m, agent_kind: _k, agent_exit: _e, agent_errored: _r,
          integrity_detail: _d, sandbox: _s, ...runFields } = report
  return {
    contract_version: 1,
    machine: {
      id: machine.id,
      chip: machine.chip,
      cpu_cores: machine.cpu_cores,
      memory_gb: machine.memory_gb,
      model_identifier: machine.model_identifier,
      model_name: machine.model_name,
      schema: 1,
    },
    suite_run_id: 'bakeoff-01',
    harness_version: '3',
    handle: 'tester',
    runs: [{ ...runFields, events_log_gz: eventsGz, test_output_gz: testGz }],
  }
}

beforeAll(async () => {
  process.env.DASHBOARD_ADMIN_TOKEN = 'test-admin-token-1234567890'
  const client = new PGlite()
  const db = drizzle(client, { schema })
  const sqlText = fx('../../drizzle/0000_init.sql').replace(/--> statement-breakpoint/g, '')
  await client.exec(sqlText)
  __setTestDb(db)
})

describe('end-to-end route flow against real Postgres (PGlite)', () => {
  it('submit -> publishes a re-validated run', async () => {
    const { POST } = await import('../src/app/api/submit/route')
    const req = new Request('http://localhost/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submissionBody()),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.accepted).toBe(1)
    expect(data.flagged).toBe(0) // evidence validates, heuristics clean
    // unsigned submission -> bad_signature flag at the batch level (informational)
    expect(data.flagReasons).toContain('bad_signature')
  })

  it('is idempotent on re-submit', async () => {
    const { POST } = await import('../src/app/api/submit/route')
    const req = new Request('http://localhost/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submissionBody()),
    })
    const data = await (await POST(req)).json()
    expect(data.idempotent).toBe(true)
  })

  it('results -> returns the published run by exact machine id', async () => {
    const { GET } = await import('../src/app/api/results/route')
    const res = await GET(new Request(`http://localhost/api/results?machineId=${machine.id}`))
    const data = await res.json()
    expect(data.results.length).toBe(1)
    expect(data.results[0].model).toBe(report.model)
    expect(data.results[0].pass).toBe(true)
  })

  it('results -> resolves via fuzzy hardware class', async () => {
    const { GET } = await import('../src/app/api/results/route')
    const res = await GET(
      new Request('http://localhost/api/results?hardwareClass=apple-m4-max__128gb'),
    )
    const data = await res.json()
    expect(data.results.length).toBe(1)
  })

  it('leaderboard -> aggregates the model server-side', async () => {
    const { GET } = await import('../src/app/api/leaderboard/route')
    const res = await GET(new Request(`http://localhost/api/leaderboard?machineId=${machine.id}`))
    const data = await res.json()
    expect(data.ranking).toContain(report.model)
    expect(data.models[report.model].pooled).toEqual([1, 1])
    expect(data.models[report.model].overall).toBe(1)
  })

  it('admin revoke -> hides the run from the public view, audited', async () => {
    const resultsRoute = await import('../src/app/api/results/route')
    const before = await (
      await resultsRoute.GET(new Request(`http://localhost/api/results?machineId=${machine.id}`))
    ).json()
    const runId = before.results[0].id

    const { POST } = await import('../src/app/api/admin/results/route')
    const res = await POST(
      new Request('http://localhost/api/admin/results', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-admin-token-1234567890',
        },
        body: JSON.stringify({
          action: 'revoke',
          targetType: 'run',
          targetId: runId,
          reason: 'integration test revoke',
          confirm: 'revoke benchmark result',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.newStatus).toBe('revoked')

    const after = await (
      await resultsRoute.GET(new Request(`http://localhost/api/results?machineId=${machine.id}`))
    ).json()
    expect(after.results.length).toBe(0) // default status=published excludes revoked
  })

  it('admin rejects revoke of an existing target without the confirm string', async () => {
    const resultsRoute = await import('../src/app/api/results/route')
    // the run still exists (revoke doesn't delete); fetch it via status=revoked
    const revoked = await (
      await resultsRoute.GET(
        new Request(`http://localhost/api/results?status=revoked&machineId=${machine.id}`),
      )
    ).json()
    const runId = revoked.results[0].id

    const { POST } = await import('../src/app/api/admin/results/route')
    const res = await POST(
      new Request('http://localhost/api/admin/results', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-admin-token-1234567890',
        },
        body: JSON.stringify({
          action: 'revoke',
          targetType: 'run',
          targetId: runId,
          reason: 'no confirm provided',
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('admin rejects a bad token', async () => {
    const { POST } = await import('../src/app/api/admin/results/route')
    const res = await POST(
      new Request('http://localhost/api/admin/results', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
        body: JSON.stringify({ action: 'preview', targetType: 'run', targetId: '00000000-0000-0000-0000-000000000000' }),
      }),
    )
    expect(res.status).toBe(401)
  })
})
