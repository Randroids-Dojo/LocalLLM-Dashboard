/**
 * POST /api/admin/results — Bearer-gated curation. Actions: preview / flag /
 * unflag / revoke. Mutations require a reason; revoke additionally requires the
 * confirm string. Reversible (status flip), never deletes — keeps forensic
 * history. Mirrors VibeRacer's admin route.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { runs, submissions, auditLog } from '@/db/schema'
import type { RunStatus } from '@/db/schema'
import { checkAdmin } from '@/lib/admin'
import { json } from '@/lib/http'
import { hashIp, getClientIp } from '@/lib/ip'

export const runtime = 'nodejs'

const REVOKE_CONFIRM = 'revoke benchmark result'

const BodySchema = z
  .object({
    action: z.enum(['preview', 'flag', 'unflag', 'revoke']),
    targetType: z.enum(['run', 'submission']),
    targetId: z.string().uuid(),
    reason: z.string().min(3).max(500).optional(),
    confirm: z.string().optional(),
  })
  .strict()

const NEW_STATUS: Record<'flag' | 'unflag' | 'revoke', RunStatus> = {
  flag: 'flagged',
  unflag: 'published',
  revoke: 'revoked',
}

export async function POST(req: Request) {
  const auth = checkAdmin(req)
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.status === 503 ? 'admin token not configured' : 'unauthorized' },
      { status: auth.status },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ ok: false, error: 'invalid body', issues: parsed.error.issues }, { status: 400 })
  }
  const { action, targetType, targetId, reason, confirm } = parsed.data
  const db = getDb()

  // fetch current state
  const targetRuns =
    targetType === 'run'
      ? await db.select().from(runs).where(eq(runs.id, targetId)).limit(1)
      : await db.select().from(runs).where(eq(runs.submissionId, targetId))
  const sub =
    targetType === 'submission'
      ? await db.select().from(submissions).where(eq(submissions.id, targetId)).limit(1)
      : []

  if (targetRuns.length === 0 && sub.length === 0) {
    return json({ ok: false, error: 'target not found' }, { status: 404 })
  }

  if (action === 'preview') {
    return json({
      ok: true,
      action,
      targetType,
      targetId,
      requiredConfirm: REVOKE_CONFIRM,
      runs: targetRuns.map((r) => ({
        id: r.id,
        runName: r.runName,
        model: r.model,
        task: r.task,
        status: r.status,
        flagReasons: r.flagReasons,
        machineId: r.machineId,
      })),
      submission: sub[0] ?? null,
    })
  }

  if (!reason) return json({ ok: false, error: 'reason required' }, { status: 400 })
  if (action === 'revoke' && confirm !== REVOKE_CONFIRM) {
    return json({ ok: false, error: `confirm must equal "${REVOKE_CONFIRM}"` }, { status: 400 })
  }

  const newStatus = NEW_STATUS[action]
  const actorIpHash = hashIp(getClientIp(req))
  const prevStatus = (sub[0]?.status ?? targetRuns[0]?.status ?? null) as RunStatus | null
  const machineId = targetRuns[0]?.machineId ?? sub[0]?.machineId ?? null

  if (targetType === 'run') {
    await db.update(runs).set({ status: newStatus }).where(eq(runs.id, targetId))
  } else {
    await db.update(runs).set({ status: newStatus }).where(eq(runs.submissionId, targetId))
    await db.update(submissions).set({ status: newStatus }).where(eq(submissions.id, targetId))
  }

  await db.insert(auditLog).values({
    action,
    targetType,
    targetId,
    machineId,
    reason,
    prevStatus,
    newStatus,
    actorIpHash,
  })

  return json({ ok: true, action, targetType, targetId, prevStatus, newStatus, affectedRuns: targetRuns.length })
}
