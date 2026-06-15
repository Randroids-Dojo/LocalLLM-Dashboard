/**
 * Submission contract (zod) — the wire shape the macOS app POSTs to /api/submit.
 * Each run is a summary.jsonl ledger row plus its gzipped raw evidence. Most
 * numeric fields are tolerant/optional so older clients don't get silently
 * dropped; the essentials (run/task/model/verdict/timestamp) are required.
 */
import { z } from 'zod'

export const MachineSchema = z.object({
  id: z.string().min(1).max(200),
  chip: z.string().min(1).max(120),
  cpu_cores: z.number().int().positive().max(1024).nullable().optional(),
  memory_gb: z.number().int().positive().max(8192).nullable().optional(),
  model_identifier: z.string().max(120).nullable().optional(),
  model_name: z.string().max(120).nullable().optional(),
  schema: z.number().optional(),
})

export const RunSchema = z.object({
  schema: z.number().optional(),
  run: z.string().min(1).max(300),
  task: z.string().min(1).max(200),
  category: z.string().max(80).optional().default(''),
  language: z.string().max(80).nullable().optional(),
  prompt_variant: z.string().max(80).optional().default('default'),
  timestamp: z.string().min(1).max(40),
  model: z.string().min(1).max(200),
  model_parameters: z.string().max(80).nullable().optional(),
  model_quant: z.string().max(80).nullable().optional(),
  verdict: z.string().max(40),
  outcome: z.string().max(40).optional().default(''),
  exit_code: z.number().int().optional(),
  tests_total: z.number().int().nonnegative().max(100000).optional(),
  tests_passed: z.number().int().nonnegative().max(100000).optional(),
  tests_failed: z.number().int().nonnegative().max(100000).optional(),
  tests_errored: z.number().int().nonnegative().max(100000).optional(),
  duration_seconds: z.number().int().nonnegative().max(100000).optional(),
  agent_seconds: z.number().int().nonnegative().max(100000).optional(),
  grade_seconds: z.number().int().nonnegative().max(100000).optional(),
  timeout_seconds: z.number().int().nonnegative().max(100000).optional(),
  turns: z.number().int().nonnegative().max(100000).optional(),
  commands: z.number().int().nonnegative().max(1000000).optional(),
  tokens_in: z.number().int().nonnegative().optional(),
  tokens_out: z.number().int().nonnegative().optional(),
  tokens_per_sec: z.number().nonnegative().max(100000).nullable().optional(),
  agent_changed_files: z.number().int().nonnegative().optional(),
  integrity_ok: z.boolean().optional(),
  repeat_index: z.number().int().optional(),
  suite_run_id: z.string().max(80).optional().default(''),
  harness_version: z.string().max(20).optional().default(''),
  // raw evidence (base64 gzip). Optional in the schema; the route flags absence.
  events_log_gz: z.string().optional(),
  test_output_gz: z.string().optional(),
})

export const SubmissionSchema = z.object({
  contract_version: z.literal(1),
  machine: MachineSchema,
  suite_run_id: z.string().max(80).nullable().optional(),
  harness_version: z.string().max(20).nullable().optional(),
  handle: z.string().max(40).nullable().optional(),
  runs: z.array(RunSchema).min(1).max(2000),
  sig: z.string().max(8192).optional(),
})

export type SubmissionBody = z.infer<typeof SubmissionSchema>
export type RunBody = z.infer<typeof RunSchema>
export type MachineBody = z.infer<typeof MachineSchema>

/** Sanitize an optional public handle: trim, strip control chars, cap length. */
export function sanitizeHandle(handle: string | null | undefined): string | null {
  if (!handle) return null
  const clean = handle.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[<>]/g, '').trim().slice(0, 40)
  return clean || null
}
