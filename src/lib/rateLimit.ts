/**
 * Submission rate limits over Upstash, via VibeKit's fixed-window primitive.
 * Fail-OPEN: when KV is unconfigured or unavailable we do not drop submissions
 * (honest data shouldn't be lost on a Redis flake); DB idempotency still bounds
 * abuse.
 */
import { getKv, incrementWithExpiry } from '@randroids-dojo/vibekit/server'

const POLICY = [
  { key: (ipHash: string, _m: string) => `rl:ip:${ipHash}`, limit: 5, windowSec: 60 },
  { key: (_ip: string, machineId: string) => `rl:machine:${machineId}`, limit: 10, windowSec: 60 },
  { key: (ipHash: string, _m: string) => `rl:ipday:${ipHash}`, limit: 200, windowSec: 86400 },
]

/** @returns true if allowed, false if any limit exceeded. */
export async function checkRateLimits(ipHash: string, machineId: string): Promise<boolean> {
  const kv = getKv()
  if (!kv) return true // fail-open
  for (const p of POLICY) {
    const count = await incrementWithExpiry(kv, p.key(ipHash, machineId), p.windowSec)
    if (count !== null && count > p.limit) return false
  }
  return true
}
