/**
 * Drizzle schema. Grain = one run row (== one summary.jsonl ledger line).
 *
 * - `machines`  : hardware dimension keyed by canonical machine_id.
 * - `submissions`: one POST batch — the rate-limit / idempotency / IP / audit unit.
 * - `runs`      : the query + aggregation grain; status lives here so one flaky
 *                 run can be flagged without nuking the whole batch.
 * - `audit_log` : admin curation history (reversible, never deletes rows).
 *
 * Stored numeric fields come from the server's evidence re-audit, NOT the
 * client's claims (see src/lib/reaudit.ts).
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const runStatus = pgEnum('run_status', ['published', 'flagged', 'revoked'])

export const machines = pgTable(
  'machines',
  {
    machineId: text('machine_id').primaryKey(), // macbook-pro-mac16-5-apple-m4-max-16c-128gb
    chip: text('chip').notNull(), // "Apple M4 Max"
    chipFamily: text('chip_family').notNull(), // "apple-m4-max"
    cpuCores: integer('cpu_cores'),
    memoryGb: integer('memory_gb'),
    memoryTier: text('memory_tier').notNull(), // "128gb"
    modelIdentifier: text('model_identifier'), // "Mac16,5"
    modelName: text('model_name'), // "MacBook Pro"
    hardwareClass: text('hardware_class').notNull(), // "apple-m4-max__128gb"
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    submissionCount: integer('submission_count').default(0).notNull(),
    runCount: integer('run_count').default(0).notNull(),
  },
  (t) => [
    index('machines_hw_class_idx').on(t.hardwareClass),
    index('machines_chip_family_idx').on(t.chipFamily, t.memoryTier),
  ],
)

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.machineId),
    suiteRunId: text('suite_run_id'),
    harnessVersion: text('harness_version'),
    handle: text('handle'), // optional public display name (sanitized)
    ipHash: text('ip_hash').notNull(), // HMAC(ip, IP_HASH_SALT)
    idempotencyKey: text('idempotency_key'), // sha256(machineId | sorted run names)
    runRowCount: integer('run_row_count').notNull(),
    acceptedCount: integer('accepted_count').notNull(),
    status: runStatus('status').notNull().default('published'), // worst-of children
    flagReasons: jsonb('flag_reasons').$type<string[]>().default([]).notNull(),
    signatureValid: boolean('signature_valid').default(false).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('submissions_machine_idx').on(t.machineId),
    uniqueIndex('submissions_idem_idx').on(t.idempotencyKey),
    index('submissions_submitted_idx').on(t.submittedAt),
  ],
)

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.machineId),

    runName: text('run_name').notNull(), // "20260610T182457Z-...-60161"
    task: text('task').notNull(),
    category: text('category').notNull(),
    language: text('language'),
    promptVariant: text('prompt_variant').default('default'),

    model: text('model').notNull(),
    modelParameters: text('model_parameters'),
    modelQuant: text('model_quant'),

    verdict: text('verdict').notNull(), // stored from evidence re-audit
    outcome: text('outcome').notNull(),
    pass: boolean('pass').notNull(),
    testsPassed: integer('tests_passed'),
    testsTotal: integer('tests_total'),

    agentSeconds: integer('agent_seconds'),
    gradeSeconds: integer('grade_seconds'),
    durationSeconds: integer('duration_seconds'),
    timeoutSeconds: integer('timeout_seconds'),
    turns: integer('turns'),
    commands: integer('commands'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    tokensPerSec: real('tokens_per_sec'),
    agentChangedFiles: integer('agent_changed_files'),
    integrityOk: boolean('integrity_ok'),
    repeatIndex: integer('repeat_index'),

    runTimestamp: timestamp('run_timestamp', { withTimezone: true }),
    suiteRunId: text('suite_run_id'),

    status: runStatus('status').notNull().default('published'),
    flagReasons: jsonb('flag_reasons').$type<string[]>().default([]).notNull(),
    serverRecomputedPass: boolean('server_recomputed_pass'),
    claimedPass: boolean('claimed_pass'), // what the client asserted (for transparency)
    artifactRef: text('artifact_ref'), // Vercel Blob URL or null

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('runs_run_name_idx').on(t.runName),
    index('runs_model_idx').on(t.model),
    index('runs_category_idx').on(t.category),
    index('runs_machine_model_idx').on(t.machineId, t.model, t.status),
    index('runs_leaderboard_idx').on(t.machineId, t.status, t.model, t.category),
    index('runs_status_idx').on(t.status),
  ],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(), // 'flag' | 'unflag' | 'revoke' | 'preview' | 'forget'
    targetType: text('target_type').notNull(), // 'run' | 'submission' | 'machine'
    targetId: text('target_id').notNull(),
    machineId: text('machine_id'),
    reason: text('reason'),
    prevStatus: runStatus('prev_status'),
    newStatus: runStatus('new_status'),
    actorIpHash: text('actor_ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
)

export type Machine = typeof machines.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type Run = typeof runs.$inferSelect
export type RunStatus = (typeof runStatus.enumValues)[number]
