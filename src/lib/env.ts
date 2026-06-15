/**
 * Validated environment access. Server-only. Throws early (at first use) with a
 * clear message if a required secret is missing, rather than failing deep in a
 * request. Optional vars return undefined and callers degrade gracefully.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL')
  },
  // Admin Bearer token (>=16 chars enforced at the route). Optional so the app
  // can boot without it; admin routes return 503 when unset.
  get adminToken() {
    return optional('DASHBOARD_ADMIN_TOKEN')
  },
  // Shared HMAC secret — also embedded in the open-source app, so this is a
  // speed-bump, not a gate. Optional: missing => every submission is unsigned.
  get submissionHmacSecret() {
    return optional('SUBMISSION_HMAC_SECRET')
  },
  // Salt for hashing client IPs (privacy). Falls back to the HMAC secret or a
  // constant so dev works; production should set it explicitly.
  get ipHashSalt() {
    return optional('IP_HASH_SALT') || optional('SUBMISSION_HMAC_SECRET') || 'localllm-dev-salt'
  },
  get blobToken() {
    return optional('BLOB_READ_WRITE_TOKEN')
  },
  // Upstash REST creds — VibeKit getKv() reads these names; rate-limiting is
  // skipped (fail-open) when absent.
  get hasKv() {
    return Boolean(
      (optional('KV_REST_API_URL') || optional('UPSTASH_REDIS_REST_URL')) &&
        (optional('KV_REST_API_TOKEN') || optional('UPSTASH_REDIS_REST_TOKEN')),
    )
  },
}
