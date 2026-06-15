/**
 * Submission signature verification (VibeKit signToken/verifyToken format).
 *
 * The signed payload is a single canonical STRING — not an object — so the
 * Swift client and this server don't have to agree on JSON key ordering:
 *
 *     canonical = `${machine_id}|${sortedRunNames.join(',')}`
 *     sig       = signToken(canonical, SUBMISSION_HMAC_SECRET)
 *               = base64url(JSON.stringify(canonical)) + "." + base64url(HMAC_SHA256(payloadB64))
 *
 * Because the secret ships in the open-source app, a valid signature only
 * proves "built from a real client", not authenticity — it sets one flag input
 * (bad_signature) and is never a hard gate.
 */
import { verifyToken } from '@randroids-dojo/vibekit/server'
import { env } from './env'

export function canonicalPayload(machineId: string, runNames: string[]): string {
  const sorted = [...runNames].sort()
  return `${machineId}|${sorted.join(',')}`
}

/**
 * @returns true when sig is present, the secret is configured, and the token
 * verifies to exactly the canonical payload for this submission. When no secret
 * is configured we cannot verify, so we report false (-> bad_signature flag).
 */
export function verifySubmissionSignature(
  sig: string | undefined,
  machineId: string,
  runNames: string[],
): boolean {
  const secret = env.submissionHmacSecret
  if (!secret || !sig) return false
  const parsed = verifyToken<string>(sig, secret)
  if (typeof parsed !== 'string') return false
  return parsed === canonicalPayload(machineId, runNames)
}
