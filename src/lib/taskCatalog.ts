/**
 * Authoritative task catalog — bundled from the benchmark suite's task.json
 * manifests (regenerate src/data/tasks.json from benchmarks/ when tasks change).
 *
 * The server reads `audit_allow`, `grade_kind`, and `expected_checks` from HERE,
 * never from the submission: `audit_allow` exempts legitimate toolchain paths
 * (e.g. `~/.dotnet/dotnet`) from the integrity scan, so if it were
 * client-supplied a faker could send a permissive list to hide a real `curl`.
 * A task absent from the catalog is treated as unknown (no exemptions).
 */
import tasksData from '../data/tasks.json' with { type: 'json' }

export interface TaskManifest {
  category: string
  language: string
  audit_allow: string[]
  grade_kind: string
  expected_checks: number
}

const catalog: Record<string, TaskManifest> = tasksData as Record<string, TaskManifest>

export function taskManifest(taskId: string): TaskManifest | null {
  return catalog[taskId] ?? null
}

export function auditAllowFor(taskId: string): string[] {
  return catalog[taskId]?.audit_allow ?? []
}

export function isKnownTask(taskId: string): boolean {
  return taskId in catalog
}

export const ASSERT_GRADERS = new Set([
  'swift-assert',
  'dotnet-assert',
  'kotlin-assert',
  'artifact-check',
])
