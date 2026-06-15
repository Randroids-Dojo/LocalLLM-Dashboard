/** Flag-reason taxonomy for the anti-fake pipeline. Stored in flag_reasons jsonb. */
export const FLAG = {
  // recompute vs claim
  scoreMismatch: 'score_mismatch',
  passesExceedTrials: 'passes_exceed_trials',
  // evidence re-audit
  missingEvidence: 'missing_evidence',
  noGradeSummary: 'no_grade_summary',
  claimVsEvidenceMismatch: 'claim_vs_evidence_mismatch',
  integrityViolation: 'integrity_violation',
  // plausibility
  tpsImplausibleHigh: 'tps_implausible_high',
  tpsImplausibleLow: 'tps_implausible_low',
  agentSecondsOverTimeout: 'agent_seconds_over_timeout',
  unknownModelTag: 'unknown_model_tag',
  unknownTask: 'unknown_task',
  machineFieldMismatch: 'machine_field_mismatch',
  timestampFuture: 'timestamp_future',
  timestampStale: 'timestamp_stale',
  tokensInconsistent: 'tokens_inconsistent',
  // signature (informational only — never a hard reject)
  badSignature: 'bad_signature',
} as const

export type FlagReason = (typeof FLAG)[keyof typeof FLAG]
