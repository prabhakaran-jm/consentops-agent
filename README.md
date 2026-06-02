# ConsentOps Agent

Hackathon demo for consent withdrawal workflows: discover synthetic PII across a warehouse, generate a classified cleanup plan, require **human approval**, execute approved actions only, re-scan to verify, and produce an audit report.

**This is not production compliance software.** The default demo uses **synthetic local data only**. Do not use real personal data in the demo.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run test      # Vitest
npm run typecheck
npm run lint
npm run build
```

**Deployment:** see [docs/cloud-run-deployment.md](docs/cloud-run-deployment.md) for Docker and Cloud Run demo deployment.

## Operating modes

### Mock demo mode (default)

The hackathon demo runs entirely on **synthetic local JSON fixtures** in `src/lib/demo/seedData.ts`.

- **Warehouse:** `scanSubjectAcrossWarehouse` in `src/lib/warehouse/localWarehouse.ts`
- **Connectors:** `MockFivetranAdapter` in `src/lib/connectors/mockFivetranAdapter.ts`
- **Planning:** deterministic planner, or Gemini when `GEMINI_API_KEY` is set (with deterministic fallback)
- **Execution:** in-memory cleanup on local tables with safety policy gates

`DEMO_MODE=true` documents the intended demo configuration. The app **already** runs only on synthetic local demo data today. `DEMO_MODE` / `CONSENTOPS_DEMO_MODE` are reserved for future environment-based adapter switching; they do **not** currently restrict operations or enforce a subject allowlist in code.

### Real Fivetran mode (placeholder)

Production connector integration is **intentionally stubbed** in `src/lib/connectors/realFivetranAdapter.ts`.

When `FIVETRAN_API_KEY` and `FIVETRAN_API_SECRET` are present, the adapter validates configuration but methods throw until implemented:

| Method | Purpose |
|--------|---------|
| `listConnectors` | List synced connectors |
| `getConnectorStatus` | Health and last sync for one connector |
| `getRecentSyncs` | Recent sync history |
| `triggerSync` | Queue a verification sync (no cleanup) |

The demo UI and workflow continue to use `MockFivetranAdapter` until a factory wires the real adapter.

### Real BigQuery mode (placeholder)

Production warehouse integration is **intentionally stubbed** in `src/lib/warehouse/bigQueryWarehouse.ts`.

When `GOOGLE_CLOUD_PROJECT` and `BIGQUERY_DATASET` are set, the adapter validates configuration but methods throw until implemented:

| Method | Purpose |
|--------|---------|
| `scanSubject` | Discover subject matches across warehouse tables |
| `dryRunCleanup` | Estimate impact of planned actions (no writes) |
| `executeApprovedCleanup` | Run DML for **explicitly approved** actions only |
| `verifyCleanup` | Re-scan after execution |

Authenticate with Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS` when implementing the TODOs.

## Environment variables

Copy `.env.example` to `.env.local`. All keys are optional for the default demo.

| Variable | Used for |
|----------|----------|
| `DEMO_MODE` | Documents intended demo mode (`true` recommended); not read by app code yet |
| `CONSENTOPS_DEMO_MODE` | Same reserved flag as `DEMO_MODE` (project rules reference this name) |
| `GEMINI_API_KEY` | Optional Gemini planning (omit for deterministic planner) |
| `GEMINI_MODEL` | Gemini model id (default `gemini-2.0-flash`) |
| `FIVETRAN_API_KEY` | Real Fivetran adapter (placeholder) |
| `FIVETRAN_API_SECRET` | Real Fivetran adapter (placeholder) |
| `GOOGLE_CLOUD_PROJECT` | BigQuery project id (placeholder) |
| `BIGQUERY_DATASET` | BigQuery dataset for warehouse tables (placeholder) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path for BigQuery (when implementing) |

## Safety model

ConsentOps is designed so destructive work cannot run by accident:

1. **Synthetic demo data only** — fictional personas in fixtures; never ingest real PII into the demo.
2. **Classified actions** — every cleanup action is `delete`, `anonymize`, `retain`, or `review`; `retain` requires `retainReason`.
3. **Human approval required** — execution checks an approval token and an explicit list of approved action IDs.
4. **No table-wide deletion** — wildcards and empty record sets are rejected.
5. **Payment records protected** — `payments_transactions` cannot be deleted or anonymized in the demo policy.
6. **Plan binding** — only actions from the generated plan may execute.
7. **Verification** — post-cleanup re-scan; audit report includes disclaimers (not legal advice).

Production adapters (`realFivetranAdapter`, `bigQueryWarehouse`) must preserve these gates when implemented.

## Project layout

```
src/lib/demo/          Demo workflow state and seed fixtures
src/lib/warehouse/     Local scanner + BigQuery placeholder
src/lib/connectors/    Mock + real Fivetran placeholders
src/lib/agent/         Gemini client + consent planner
src/lib/execution/     Safety policy + cleanup executor
src/lib/audit/         Audit report generation
src/app/api/           scan, plan, execute, audit routes
```

## License

MIT — see [LICENSE](LICENSE).
