/**
 * POST /api/results/forget — self-serve data removal (privacy policy).
 * Revokes (hides) every run for a machine_id. Authorized by EITHER the admin
 * Bearer token OR a signature over `forget|${machineId}` (the app signs this
 * with the shared secret). Reversible (status -> revoked), audited, never
 * deletes rows. The signed path is a courtesy, not strong auth (open-source
 * secret); admins can also revoke per the admin route.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { verifyToken } from '@randroids-dojo/vibekit/server'
import { getDb } from '@/db/client'
import { runs, auditLog } from '@/db/schema'
import { checkAdmin } from '@/lib/admin'
import { json } from '@/lib/http'
import { env } from '@/lib/env'
import { hashIp, getClientIp } from '@/lib/ip'

export const runtime = 'nodejs'

const BodySchema = z.object({ machineId: z.string().min(1).max(200), sig: z.string().max(8192).optional() }).strict()

function signatureAuthorizes(sig: string | undefined, machineId: string): boolean {
  const secret = env.submissionHmacSecret
  if (!secret || !sig) return false
  const parsed = verifyToken<string>(sig, secret)
  return parsed === `forget|${machineId}`
}

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return json({ ok: false, error: 'invalid body' }, { status: 400 })
  const { machineId, sig } = parsed.data

  const isAdmin = checkAdmin(req).ok
  if (!isAdmin && !signatureAuthorizes(sig, machineId)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const affected = await db
    .update(runs)
    .set({ status: 'revoked' })
    .where(eq(runs.machineId, machineId))
    .returning({ id: runs.id })

  await db.insert(auditLog).values({
    action: 'forget',
    targetType: 'machine',
    targetId: machineId,
    machineId,
    reason: isAdmin ? 'admin forget' : 'self-serve forget (signed)',
    newStatus: 'revoked',
    actorIpHash: hashIp(getClientIp(req)),
  })

  return json({ ok: true, machineId, revokedRuns: affected.length })
}
