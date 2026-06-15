# LocalLLM Dashboard

A public benchmark-results database + dashboard for the
[LocalLLM](../LocalLLM) macOS app. The app runs local Ollama coding models
through a benchmark suite; this site collects per-machine results, re-validates
them server-side, and shows leaderboards by hardware class.

- **Next.js** (App Router) on Vercel
- **Neon Postgres** + Drizzle ORM (durable store)
- **Upstash Redis** for rate-limit counters (via [VibeKit](https://github.com/Randroids-Dojo/VibeKit))
- Auto-publish + heuristic flag + admin revoke (shared Bearer token); no login

## How results are trusted

The HMAC secret ships in the open-source app, so a signature only proves "built
from a real client" — it is one flag input, never a gate. The real anti-fake
mechanism is **server-side re-derivation of every result field from the raw
evidence** the submission carries:

- `src/lib/reaudit.ts` re-runs the benchmark harness's `audit_and_metrics`
  (integrity scan, turns, commands, tokens) over the submitted `events.log` and
  `parse_grade_summary` over `test-output.txt`. The **re-derived** values are
  stored, not the client's claims; mismatches are flagged.
- `src/lib/scoring.ts` recomputes the leaderboard (Wilson 95% pooled intervals)
  from the run rows — client aggregates are never trusted.
- Plausibility heuristics (`src/lib/heuristics.ts`), rate limits, and admin
  revoke cover the rest.

`scoring.ts`, `fingerprint.ts`, and `reaudit.ts` are faithful ports of the
app's `benchmarks/suite/score.py`, `harness/lib/machine_spec.py`, and
`harness/lib/report.py`. `npm test` asserts parity against real fixtures and runs
an end-to-end submit→leaderboard→admin flow against in-process Postgres (PGlite).

## Develop

```bash
npm install
vercel env pull            # Neon + Upstash from the Vercel project
npm run db:migrate         # apply drizzle migrations (uses the unpooled URL)
npm run dev
npm test                   # 20 tests: parity + end-to-end routes
```

Provision Neon and Upstash via the Vercel Marketplace; set the app-owned secrets
manually (`DASHBOARD_ADMIN_TOKEN`, `SUBMISSION_HMAC_SECRET`, `IP_HASH_SALT`). See
`.env.example`.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/submit` | Ingest a batch of runs; re-audit, recompute, flag, store. |
| `GET /api/results` | Filtered run rows (exact `machineId` or fuzzy `hardwareClass`). |
| `GET /api/leaderboard` | Aggregated per-model scores (same shape as the app's `leaderboard.json`). |
| `GET /api/machines` | Known machine classes for the filter UI. |
| `POST /api/admin/results` | Bearer-gated preview / flag / unflag / revoke (+ audit). |
| `POST /api/results/forget` | Self-serve / admin removal of a machine's results. |

## The submission contract

The macOS app's `DashboardService` posts the shape validated by
`src/lib/contract.ts`: a `machine` block, `runs[]` (summary.jsonl ledger rows
each carrying gzipped `events_log_gz` + `test_output_gz`), and a `sig`
(`signToken(`​`${machineId}|${sortedRunNames}`​`)`). The `machine_id` and the
`signToken` format are verified to match the app byte-for-byte.
