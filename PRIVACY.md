# Privacy

This is the source for the privacy policy served at `/privacy` (see
`src/app/privacy/page.tsx`), the canonical version.

The dashboard stores benchmark results **only when a user publishes them** from
the LocalLLM app. Publishing is opt-in.

## Collected when a user publishes

- Hardware class and machine id (chip, model identifier, CPU cores, memory) —
  a non-identifying bucket like `macbook-pro-mac16-5-apple-m4-max-16c-128gb`.
- Benchmark results (model, task, pass/fail, test counts, timing, tokens/sec).
- Raw run evidence — each run's `events.log` and grader transcript — uploaded so
  the server can re-validate results. These become public.
- An optional display handle.
- A salted HMAC of the submitter's IP (server-side), used only for rate-limiting
  and abuse handling. The raw IP is never stored.

## Never collected

Serial number, hardware UUID, provisioning UDID, host name, user name.

## Controls

- Publishing is opt-in and never automatic.
- Users can remove their data via the app ("Remove my data") or by an admin
  revoke, which hides all results for a machine. Published data is public and may
  have been cached by others.

## Moderation

Every submission is re-validated server-side from its raw evidence, rate-limited,
and checked for plausibility. Implausible results are flagged; admins can revoke
abusive or fake results. This keeps honest data clean — it is not proof of
hardware provenance.
