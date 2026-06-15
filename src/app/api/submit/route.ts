/**
 * POST /api/submit — benchmark result ingestion.
 *
 * parse -> zod -> verify signature (flag only) -> rate-limit -> idempotency ->
 * gunzip + EVIDENCE RE-AUDIT each run (store re-derived values, not claims) ->
 * recompute pass -> plausibility heuristics -> flag mismatches -> archive
 * evidence to Blob -> upsert machine + insert submission/runs. Malformed /
 * over-limit / wholly-evidence-free -> 202 silent drop (mirrors VibeRacer).
 */
import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { machines, submissions, runs } from '@/db/schema'
import type { RunStatus } from '@/db/schema'
import { SubmissionSchema, sanitizeHandle } from '@/lib/contract'
import { silentDrop, json } from '@/lib/http'
import { getClientIp, hashIp } from '@/lib/ip'
import { checkRateLimits } from '@/lib/rateLimit'
import { verifySubmissionSignature } from '@/lib/sign'
import { gunzipBase64, archiveEvidence, EvidenceError } from '@/lib/evidence'
import { reauditRun } from '@/lib/reaudit'
import { auditAllowFor } from '@/lib/taskCatalog'
import { evidenceFlags, runHeuristics, parseRunTimestamp } from '@/lib/heuristics'
import { chipFamily, memoryTier, hardwareClass } from '@/lib/fingerprint'
import { FLAG } from '@/lib/flags'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1. parse
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return silentDrop()
  }

  // 2. validate
  const parsed = SubmissionSchema.safeParse(raw)
  if (!parsed.success) return silentDrop()
  const body = parsed.data
  const machine = body.machine

  // wholly evidence-free batch = junk
  if (!body.runs.some((r) => r.events_log_gz && r.test_output_gz)) return silentDrop()

  const cf = chipFamily(machine.chip)
  const mt = memoryTier(machine.memory_gb ?? null)
  const hwClass = hardwareClass(machine.chip, machine.memory_gb ?? null)

  // 3. signature (flag only, never a gate)
  const runNames = body.runs.map((r) => r.run)
  const signatureValid = verifySubmissionSignature(body.sig, machine.id, runNames)

  // 4. ip + rate limit
  const ipHash = hashIp(getClientIp(req))
  const allowed = await checkRateLimits(ipHash, machine.id)
  if (!allowed) return silentDrop()

  const db = getDb()

  // 5. idempotency
  const idemKey = createHash('sha256')
    .update(`${machine.id}|${[...runNames].sort().join(',')}`)
    .digest('hex')
  const existing = await db
    .select({ id: submissions.id, status: submissions.status, accepted: submissions.acceptedCount })
    .from(submissions)
    .where(eq(submissions.idempotencyKey, idemKey))
    .limit(1)
  if (existing.length > 0) {
    return json({ ok: true, idempotent: true, submissionId: existing[0]!.id })
  }

  // 6. per-run re-audit + flagging
  const submissionId = randomUUID()
  const submittedAtMs = Date.now()
  const runRecords: (typeof runs.$inferInsert)[] = []
  const batchFlags = new Set<string>()
  let flaggedCount = 0

  for (const run of body.runs) {
    const flags = new Set<string>()
    let evPass: boolean | null = null
    let testsPassed = run.tests_passed ?? null
    let testsTotal = run.tests_total ?? null
    let turns = run.turns ?? null
    let commands = run.commands ?? null
    let tokensIn = run.tokens_in ?? null
    let tokensOut = run.tokens_out ?? null
    let integrityOk = run.integrity_ok ?? null
    let artifactRef: string | null = null

    if (run.events_log_gz && run.test_output_gz) {
      try {
        const events = gunzipBase64(run.events_log_gz)
        const testOutput = gunzipBase64(run.test_output_gz)
        const ev = reauditRun(events, testOutput, run.agent_seconds ?? null, auditAllowFor(run.task))
        // store re-derived values, not the client's claims
        evPass = ev.pass
        testsPassed = ev.passed
        testsTotal = ev.total
        turns = ev.turns
        commands = ev.commands
        tokensIn = ev.tokensIn
        tokensOut = ev.tokensOut
        integrityOk = ev.integrityOk
        for (const f of evidenceFlags(run, ev)) flags.add(f)
        artifactRef = await archiveEvidence(machine.id, run.run, run.events_log_gz, run.test_output_gz)
      } catch (e) {
        if (e instanceof EvidenceError) flags.add(FLAG.missingEvidence)
        else throw e
      }
    } else {
      flags.add(FLAG.missingEvidence)
    }

    for (const f of runHeuristics(run, machine, cf, submittedAtMs)) flags.add(f)

    const claimedPass = run.verdict === 'pass'
    // evidence pass when we have it; otherwise fall back to the claim (but the
    // run is flagged missing_evidence and so excluded from the public view).
    const serverPass = evPass ?? claimedPass
    const verdict = serverPass ? 'pass' : run.verdict || 'fail'
    const status: RunStatus = flags.size > 0 ? 'flagged' : 'published'
    if (status === 'flagged') flaggedCount++
    for (const f of flags) batchFlags.add(f)

    const tsMs = parseRunTimestamp(run.timestamp)

    runRecords.push({
      id: randomUUID(),
      submissionId,
      machineId: machine.id,
      runName: run.run,
      task: run.task,
      category: run.category || '',
      language: run.language ?? null,
      promptVariant: run.prompt_variant || 'default',
      model: run.model,
      modelParameters: run.model_parameters ?? null,
      modelQuant: run.model_quant ?? null,
      verdict,
      outcome: run.outcome || '',
      pass: serverPass,
      testsPassed,
      testsTotal,
      agentSeconds: run.agent_seconds ?? null,
      gradeSeconds: run.grade_seconds ?? null,
      durationSeconds: run.duration_seconds ?? null,
      timeoutSeconds: run.timeout_seconds ?? null,
      turns,
      commands,
      tokensIn,
      tokensOut,
      tokensPerSec: run.tokens_per_sec ?? null,
      agentChangedFiles: run.agent_changed_files ?? null,
      integrityOk,
      repeatIndex: run.repeat_index ?? null,
      runTimestamp: tsMs !== null ? new Date(tsMs) : null,
      suiteRunId: run.suite_run_id || body.suite_run_id || null,
      status,
      flagReasons: [...flags] as string[],
      serverRecomputedPass: evPass,
      claimedPass,
      artifactRef,
    })
  }

  if (!signatureValid) batchFlags.add(FLAG.badSignature)
  const batchStatus: RunStatus = flaggedCount === runRecords.length && flaggedCount > 0 ? 'flagged' : 'published'

  // 7. persist (machine -> submission -> runs, ordered for FKs)
  await db
    .insert(machines)
    .values({
      machineId: machine.id,
      chip: machine.chip,
      chipFamily: cf,
      cpuCores: machine.cpu_cores ?? null,
      memoryGb: machine.memory_gb ?? null,
      memoryTier: mt,
      modelIdentifier: machine.model_identifier ?? null,
      modelName: machine.model_name ?? null,
      hardwareClass: hwClass,
      submissionCount: 1,
      runCount: runRecords.length,
    })
    .onConflictDoUpdate({
      target: machines.machineId,
      set: {
        lastSeen: sql`now()`,
        submissionCount: sql`${machines.submissionCount} + 1`,
        runCount: sql`${machines.runCount} + ${runRecords.length}`,
        chip: machine.chip,
        chipFamily: cf,
        memoryTier: mt,
        hardwareClass: hwClass,
      },
    })

  await db.insert(submissions).values({
    id: submissionId,
    machineId: machine.id,
    suiteRunId: body.suite_run_id ?? null,
    harnessVersion: body.harness_version ?? null,
    handle: sanitizeHandle(body.handle),
    ipHash,
    idempotencyKey: idemKey,
    runRowCount: runRecords.length,
    acceptedCount: runRecords.length,
    status: batchStatus,
    flagReasons: [...batchFlags] as string[],
    signatureValid,
  })

  await db.insert(runs).values(runRecords).onConflictDoNothing({ target: runs.runName })

  // per-model summary for the client
  const perModel = summarizeByModel(runRecords)

  return json({
    ok: true,
    submissionId,
    accepted: runRecords.length,
    flagged: flaggedCount,
    flagReasons: [...batchFlags],
    signatureValid,
    perModel,
  })
}

function summarizeByModel(records: (typeof runs.$inferInsert)[]) {
  const map = new Map<string, { runs: number; passes: number; flagged: number }>()
  for (const r of records) {
    const m = map.get(r.model) ?? { runs: 0, passes: 0, flagged: 0 }
    m.runs++
    if (r.pass) m.passes++
    if (r.status === 'flagged') m.flagged++
    map.set(r.model, m)
  }
  return Object.fromEntries(map)
}
