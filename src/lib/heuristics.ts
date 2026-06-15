/**
 * Plausibility heuristics for the fields the evidence re-audit can't cover —
 * chiefly wall-clock-derived tokens/sec, timing, machine-id integrity, and
 * model/task allow-lists. Each returns flag reasons; a flagged run is still
 * stored (status='flagged'), just hidden from the default public view.
 */
import { FLAG, type FlagReason } from './flags'
import { isKnownModel } from './knownModels'
import { isKnownTask } from './taskCatalog'
import { machineId as regenMachineId } from './fingerprint'
import type { RunBody, MachineBody } from './contract'
import type { EvidenceVerdict } from './reaudit'

/**
 * Per-chip-family tokens/sec ceiling. Local Apple-silicon decode throughput for
 * these model sizes sits well under these bounds; anything above is implausible.
 * Unknown families fall back to a generous global ceiling.
 */
const TPS_CEILING: Record<string, number> = {
  'apple-m4-max': 400,
  'apple-m3-max': 400,
  'apple-m2-max': 350,
  'apple-m1-max': 300,
}
const TPS_CEILING_DEFAULT = 500

/** Heuristics that depend only on the claimed run + machine fields. */
export function runHeuristics(
  run: RunBody,
  machine: MachineBody,
  chipFamily: string,
  submittedAtMs: number,
): FlagReason[] {
  const flags: FlagReason[] = []

  if (!isKnownModel(run.model)) flags.push(FLAG.unknownModelTag)
  if (!isKnownTask(run.task)) flags.push(FLAG.unknownTask)

  const ceiling = TPS_CEILING[chipFamily] ?? TPS_CEILING_DEFAULT
  if (typeof run.tokens_per_sec === 'number') {
    if (run.tokens_per_sec > ceiling) flags.push(FLAG.tpsImplausibleHigh)
    if (run.tokens_per_sec < 0) flags.push(FLAG.tpsImplausibleLow)
  }

  if (
    typeof run.agent_seconds === 'number' &&
    typeof run.timeout_seconds === 'number' &&
    run.timeout_seconds > 0 &&
    run.agent_seconds > run.timeout_seconds + 5 // small clock-skew grace
  ) {
    flags.push(FLAG.agentSecondsOverTimeout)
  }

  // machine_id must regenerate from the submitted hardware fields.
  const regen = regenMachineId({
    model_name: machine.model_name,
    model_identifier: machine.model_identifier,
    chip: machine.chip,
    cpu_cores: machine.cpu_cores,
    memory_gb: machine.memory_gb,
  })
  if (regen !== machine.id) flags.push(FLAG.machineFieldMismatch)

  // timestamp sanity (format YYYYMMDDThhmmssZ)
  const ts = parseRunTimestamp(run.timestamp)
  if (ts !== null) {
    if (ts > submittedAtMs + 60 * 60 * 1000) flags.push(FLAG.timestampFuture)
    if (ts < submittedAtMs - 2 * 365 * 24 * 60 * 60 * 1000) flags.push(FLAG.timestampStale)
  }

  return flags
}

/** Heuristics comparing the client's claims against the server's re-audit. */
export function evidenceFlags(run: RunBody, ev: EvidenceVerdict): FlagReason[] {
  const flags: FlagReason[] = []

  if (!run.events_log_gz || !run.test_output_gz) {
    flags.push(FLAG.missingEvidence)
    return flags // can't compare further without evidence
  }

  if (!ev.summaryPresent) flags.push(FLAG.noGradeSummary)
  if (!ev.integrityOk) flags.push(FLAG.integrityViolation)

  // claimed pass must match evidence-supported pass
  const claimedPass = run.verdict === 'pass'
  if (claimedPass !== ev.pass) flags.push(FLAG.claimVsEvidenceMismatch)

  // claimed test counts must match the re-parsed grade summary
  if (typeof run.tests_passed === 'number' && run.tests_passed !== ev.passed) {
    flags.push(FLAG.claimVsEvidenceMismatch)
  }
  if (typeof run.tests_total === 'number' && run.tests_total !== ev.total) {
    flags.push(FLAG.claimVsEvidenceMismatch)
  }

  // tokens/sec consistency: claimed vs tokens_out/agent_seconds (10% tolerance)
  if (
    typeof run.tokens_per_sec === 'number' &&
    ev.tokensPerSec !== null &&
    ev.tokensPerSec > 0 &&
    Math.abs(run.tokens_per_sec - ev.tokensPerSec) / ev.tokensPerSec > 0.1
  ) {
    flags.push(FLAG.tokensInconsistent)
  }

  return Array.from(new Set(flags))
}

/** Parse the harness "20260610T182457Z" timestamp to epoch ms, or null. */
export function parseRunTimestamp(ts: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(ts)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  return Number.isFinite(ms) ? ms : null
}
