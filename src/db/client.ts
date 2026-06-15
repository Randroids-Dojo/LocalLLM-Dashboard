/**
 * Drizzle client over the Neon serverless HTTP driver — connection-poolless and
 * safe to call from route handlers / server components without managing a pool.
 */
import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

type Db = NeonHttpDatabase<typeof schema>

let _db: Db | null = null

export function getDb(): Db {
  if (!_db) {
    _db = drizzle(neon(env.databaseUrl), { schema })
  }
  return _db
}

/**
 * Test-only: inject a drizzle instance (e.g. PGlite-backed). Cast through
 * `unknown` — the PGlite driver shares the same query API but has a distinct
 * static type; getDb() stays strongly typed for callers.
 */
export function __setTestDb(db: unknown) {
  _db = db as Db
}

export { schema }
