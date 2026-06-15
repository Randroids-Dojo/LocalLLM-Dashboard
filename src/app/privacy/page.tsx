export const metadata = { title: 'Privacy & Data — LocalLLM Benchmark Dashboard' }

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-3xl prose-headings:font-semibold">
      <h1>Privacy &amp; data</h1>
      <p className="text-neutral-400">
        This dashboard collects benchmark results <strong>only when you choose to publish them</strong>{' '}
        from the LocalLLM app. Publishing is opt-in. You can opt out at install, when running
        benchmarks, or in the app&apos;s Settings — and remove your data at any time.
      </p>

      <h2>What is collected when you publish</h2>
      <ul>
        <li>
          <strong>Hardware class &amp; machine id</strong> — chip (e.g. &ldquo;Apple M4 Max&rdquo;),
          model identifier, CPU core count, and memory size, combined into a non-identifying bucket
          such as <code>macbook-pro-mac16-5-apple-m4-max-16c-128gb</code>.
        </li>
        <li>
          <strong>Benchmark results</strong> — per-run model, task, pass/fail, test counts, timing,
          turns, and tokens/second.
        </li>
        <li>
          <strong>Raw run evidence</strong> — each run&apos;s <code>events.log</code> (the agent&apos;s
          reasoning and the shell commands it ran) and the grader transcript. These are uploaded so the
          server can re-validate the result, and they become public. They can contain task-related
          text.
        </li>
        <li>
          <strong>A salted hash of your IP address</strong> — computed server-side, used only for
          rate-limiting and abuse handling. The raw IP is never stored.
        </li>
        <li>An optional display handle, if you choose to provide one.</li>
      </ul>

      <h2>What is never collected</h2>
      <p>
        Serial number, hardware UUID, provisioning UDID, host name, and user name are explicitly
        excluded by the benchmark tooling and never leave your machine.
      </p>

      <h2>Your controls</h2>
      <ul>
        <li>Publishing is opt-in and never automatic.</li>
        <li>Opt out during install, when running benchmarks, or in Settings.</li>
        <li>
          Remove your data anytime from the app (&ldquo;Remove my data from the dashboard&rdquo;), which
          revokes every result for your machine bucket.
        </li>
      </ul>

      <h2>Nature of published data</h2>
      <p>
        Published results are public and may be viewed, cached, or indexed by others. Removal hides
        them here, but copies others have already made cannot be recalled.
      </p>

      <h2>Re-validation &amp; moderation</h2>
      <p>
        Every submission is re-validated server-side from its raw evidence, rate-limited, and checked
        for plausibility. Implausible results are flagged; administrators can revoke abusive or fake
        results. This keeps honest data clean — it is not, and cannot be, proof of hardware
        provenance.
      </p>
    </article>
  )
}
