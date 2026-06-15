/** Client IP resolution + privacy-preserving hashing. */
import { createHmac } from 'node:crypto'
import { env } from './env'

/** First hop of x-forwarded-for, mirroring VibeRacer's getClientIp. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Salted HMAC so we never store raw IPs — used only for rate-limit/audit. */
export function hashIp(ip: string): string {
  return createHmac('sha256', env.ipHashSalt).update(ip).digest('hex').slice(0, 32)
}
