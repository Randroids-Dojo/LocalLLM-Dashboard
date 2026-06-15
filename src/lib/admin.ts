/** Admin Bearer-token auth — constant-time, mirroring VibeRacer's admin route. */
import { timingSafeEqual } from 'node:crypto'
import { env } from './env'

export type AdminAuth = { ok: true } | { ok: false; status: 401 | 503 }

export function checkAdmin(req: Request): AdminAuth {
  const token = env.adminToken
  if (!token || token.length < 16) return { ok: false, status: 503 } // not configured
  const header = req.headers.get('authorization')
  const prefix = 'Bearer '
  if (!header?.startsWith(prefix)) return { ok: false, status: 401 }
  const candidate = header.slice(prefix.length)
  const expected = Buffer.from(token)
  const actual = Buffer.from(candidate)
  if (expected.length !== actual.length) return { ok: false, status: 401 }
  if (!timingSafeEqual(expected, actual)) return { ok: false, status: 401 }
  return { ok: true }
}
