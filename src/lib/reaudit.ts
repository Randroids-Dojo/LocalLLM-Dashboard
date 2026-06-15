/**
 * Server-side evidence re-audit — a port of the trust-bearing parts of
 * benchmarks/harness/lib/report.py (`audit_and_metrics`, `parse_grade_summary`,
 * `count_check_lines`, `strip_inert_regions`, and the integrity token lists).
 *
 * Submissions ship the raw `events.log` (Codex event stream) and
 * `test-output.txt` (grader transcript). The submit route re-runs this logic
 * and STORES the recomputed values rather than the client's claims; any claim
 * that disagrees with the evidence is flagged. This is the core anti-fake
 * mechanism — a faker must forge a coherent multi-KB event stream + a matching
 * grader transcript, not just type self-consistent numbers.
 *
 * Limit (documented): the event log proves work done (integrity, grading,
 * turns, commands, token counts) but NOT wall-clock speed — agent_seconds is
 * external harness timing, so tokens_per_sec stays heuristic-bounded.
 */

// Mirrors report.py SUSPICIOUS_TOKENS (substring match against lowercased cmd).
const SUSPICIOUS_TOKENS = [
  '/users/',
  '/home/',
  '~/',
  '/volumes/',
  'mdfind',
  'find ~',
  'find $home',
  '$here',
  '${here',
  '$task_dir',
  '${task_dir',
  '$results_dir',
  '${results_dir',
  'curl ',
  'wget ',
  'git clone',
  'pip install',
  'pip3 install',
  'npm install',
  'npm ci',
  'yarn add',
  'brew install',
  'ollama',
  'osascript',
  'defaults read',
  'security find',
]

// Mirrors report.py SUSPICIOUS_COMMANDS (word-boundary matched short tools).
const SUSPICIOUS_COMMANDS = [
  /(?:^|[\s;|&(])nc\s/,
  /(?:^|[\s;|&(])ssh\s/,
  /(?:^|[\s;|&(])scp\s/,
  /(?:^|[\s;|&(])telnet\s/,
  /(?:^|[\s;|&(])locate\s/,
]

const HEREDOC = /<<-?\s*['"]?([a-z0-9_]+)['"]?[\s\S]*?(?:^|\n)\1\b/g
const PATCH_BODY = /\*\*\*\s*begin patch[\s\S]*?\*\*\*\s*end patch/g
const COMMENT = /#[^\n]*/g

/** Port of report.py `strip_inert_regions`. Input/return are lowercased. */
export function stripInertRegions(cmd: string): string {
  return cmd.replace(HEREDOC, ' ').replace(PATCH_BODY, ' ').replace(COMMENT, ' ')
}

export interface AuditMetrics {
  integrityOk: boolean
  integrityDetail: string
  turns: number
  commands: number
  tokensIn: number
  tokensOut: number
}

/** Port of report.py `audit_and_metrics` over an events.log string. */
export function auditAndMetrics(eventsText: string, auditAllow: string[] = []): AuditMetrics {
  let integrityOk = true
  let integrityDetail = 'No agent command accessed paths outside the temp workspace.'
  let turns = 0
  let commands = 0
  let tokensIn = 0
  let tokensOut = 0
  const allow = auditAllow.filter(Boolean).map((a) => a.toLowerCase())

  for (const line of eventsText.split('\n')) {
    if (line.includes('"turn.completed"')) {
      let obj: any
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      if (obj?.type !== 'turn.completed') continue
      turns += 1
      const usage = obj.usage || {}
      tokensIn += Number(usage.input_tokens) || 0
      tokensOut += (Number(usage.output_tokens) || 0) + (Number(usage.reasoning_output_tokens) || 0)
      continue
    }
    if (!line.includes('"command_execution"')) continue
    let obj: any
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    const item = obj?.item ?? obj
    if (item?.type !== 'command_execution') continue
    if (obj?.type === 'item.completed') {
      commands += 1
    } else if (obj?.type !== 'item.started') {
      continue
    }
    const cmd = (item.command || '').toLowerCase()
    if (!cmd || !integrityOk) continue
    if (allow.some((a) => cmd.includes(a))) continue

    const scan = stripInertRegions(cmd)
    let hit: string | null = null
    for (const token of SUSPICIOUS_TOKENS) {
      if (scan.includes(token)) {
        hit = JSON.stringify(token)
        break
      }
    }
    if (hit === null) {
      for (const pattern of SUSPICIOUS_COMMANDS) {
        if (pattern.test(scan)) {
          hit = pattern.source
          break
        }
      }
    }
    if (hit !== null) {
      integrityOk = false
      integrityDetail =
        `A command reached outside the workspace or used a forbidden tool (matched ${hit}): ` +
        (item.command || '').slice(0, 200)
    }
  }

  return { integrityOk, integrityDetail, turns, commands, tokensIn, tokensOut }
}

export interface GradeSummary {
  total: number
  passed: number
  failed: number
  errored: number
  summaryPresent: boolean
}

/** Port of report.py `parse_grade_summary` (keeps the LAST GRADE_SUMMARY line). */
export function parseGradeSummary(testOutput: string): GradeSummary {
  const re = /GRADE_SUMMARY total=(\d+) passed=(\d+) failed=(\d+) errored=(\d+)/g
  let m: RegExpExecArray | null
  let last: RegExpExecArray | null = null
  while ((m = re.exec(testOutput)) !== null) last = m
  if (last) {
    return {
      total: Number(last[1]),
      passed: Number(last[2]),
      failed: Number(last[3]),
      errored: Number(last[4]),
      summaryPresent: true,
    }
  }
  return { total: 0, passed: 0, failed: 0, errored: 0, summaryPresent: false }
}

/** Port of report.py `count_check_lines`. */
export function countCheckLines(testOutput: string): { pass: number; total: number } {
  let pass = 0
  let total = 0
  const re = /^\s*CHECK\s+\S.*\b(PASS|FAIL)\s*$/
  for (const line of testOutput.split('\n')) {
    const m = re.exec(line)
    if (m) {
      total += 1
      if (m[1] === 'PASS') pass += 1
    }
  }
  return { pass, total }
}

export interface EvidenceVerdict extends AuditMetrics, GradeSummary {
  tokensPerSec: number | null
  gradingOk: boolean
  /** evidence-supported pass: integrity_ok AND grading_ok. */
  pass: boolean
}

/**
 * Re-derive everything the evidence can support for one run. `agent_seconds`
 * is external harness timing (not in the event log); it is passed in only to
 * recompute tokens_per_sec for a consistency check, and is itself trusted.
 *
 * gradingOk approximates report.py's grading gate from evidence alone: a real
 * GRADE_SUMMARY with every check passing. The CHECK-line cross-check is applied
 * when CHECK lines are present (assert-style graders); `expected_checks` lives
 * in the task manifest and is not enforced here (documented limit).
 */
export function reauditRun(
  eventsText: string,
  testOutput: string,
  agentSeconds: number | null,
  auditAllow: string[] = [],
): EvidenceVerdict {
  const metrics = auditAndMetrics(eventsText, auditAllow)
  const grade = parseGradeSummary(testOutput)
  const checks = countCheckLines(testOutput)
  const checkOk = checks.total > 0 ? checks.total === grade.total && checks.pass === grade.passed : true
  const gradingOk =
    grade.summaryPresent &&
    checkOk &&
    grade.total > 0 &&
    grade.passed === grade.total &&
    grade.failed === 0 &&
    grade.errored === 0
  const pass = metrics.integrityOk && gradingOk
  const tokensPerSec =
    agentSeconds && agentSeconds > 0 && metrics.tokensOut
      ? Math.round((metrics.tokensOut / agentSeconds) * 100) / 100
      : null
  return { ...metrics, ...grade, tokensPerSec, gradingOk, pass }
}
