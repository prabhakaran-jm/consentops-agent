# Fivetran + BigQuery full demo

**Fivetran partner integration:** [Option 1 MCP (primary)](fivetran-mcp-evidence.md) — read-only evidence in your agent host. **Option 2 REST** in the ConsentOps UI is a secondary mirror for judges who only open the web app (no code change required).

Use **live Fivetran connections** and run **cleanup DML on BigQuery** so the post-execution audit **after** count can drop when you delete or anonymize rows.

## Architecture (hackathon-safe)

| Layer | What it does |
|-------|----------------|
| **Fivetran** | Read-only REST panel: connection count, health, last sync, inferred mapped tables. No sync triggers or cleanup via Fivetran. |
| **BigQuery** | Scan, execute, and verify on dataset `BIGQUERY_DATASET` (default `consentops_demo`) with synthetic Ana Reyes fixtures. |
| **ConsentOps** | Classified plan → human approval → `DELETE` / `UPDATE` on explicit record IDs only. |

Demo tables are loaded with `npm run bigquery:setup` (same record IDs as local JSON). Fivetran connectors are the **ingestion story**; cleanup targets the **demo dataset** you control. You do not need Fivetran to replicate into `consentops_demo` for the flow to work.

## 1. Environment (`.env.local`)

```env
DEMO_MODE=true
CONSENTOPS_DEMO_MODE=true

# Gemini (optional)
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash

# Fivetran — live read-only panel
FIVETRAN_API_KEY=your_key
FIVETRAN_API_SECRET=your_secret

# BigQuery — scan + execute + verify on BQ
CONSENTOPS_WAREHOUSE_MODE=bigquery_full
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
BIGQUERY_DATASET=consentops_demo
# Optional locally if not using: gcloud auth application-default login
# GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

Restart the dev server after changing env: `npm run dev`.

**Platform status should show:** `Warehouse: bigquery_full`, `Scan: bigquery`, `Execute: bigquery`, `Fivetran: live_read_only`.

## 2. Google Cloud auth and IAM

```bash
gcloud auth application-default login --project=YOUR_PROJECT_ID
```

For **`bigquery_full`** your identity (or Cloud Run service account) needs:

| Role | Purpose |
|------|---------|
| `roles/bigquery.dataViewer` | Scan / match discovery |
| `roles/bigquery.dataEditor` | `DELETE` and anonymize `UPDATE` on demo tables |
| `roles/bigquery.jobUser` | Run queries |

Example (your user on the project):

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOU@example.com" \
  --role="roles/bigquery.dataEditor"
```

Repeat for `dataViewer` and `jobUser` if missing.

## 3. Load synthetic demo tables into BigQuery

```bash
npm install
npm run bigquery:setup:dry-run   # optional preview
npm run bigquery:setup
```

Confirm scan finds **25** matches for Ana Reyes on hosted BigQuery (**37** on local JSON fixtures) in the UI (Step 3).

## 4. Fivetran: at least one connection

If the panel shows **0 connections** with `live_read_only`, the API key works but the account has no connectors yet.

1. Open [Fivetran dashboard](https://fivetran.com/dashboard) → **Add connection**.
2. Pick any source you have (e.g. **Google Sheets**, **Stripe** test, **File**).
3. Set **destination** to **BigQuery** on the **same GCP project** as `GOOGLE_CLOUD_PROJECT` (for a coherent demo narrative).
4. Complete setup and run an initial sync.
5. In ConsentOps, run **Scan** again — Step 2 should list ≥1 connection with health and last sync.

Credentials: [Fivetran API key](https://fivetran.com/dashboard/account/api-keys) → `FIVETRAN_API_KEY` + `FIVETRAN_API_SECRET`.

**Note:** ConsentOps does not call Fivetran to write to BigQuery. Connector schema names (e.g. `stripe_warehouse`) are separate from `consentops_demo` unless you deliberately align them.

## 5. End-to-end demo flow

1. **Scan** — **25** matches on hosted BigQuery (37 on local JSON), `scanSource: bigquery`, Fivetran MCP discovery + connectors visible.
2. **Generate plan** — Gemini or deterministic fallback.
3. **Approval** — Select a few **delete** or **anonymize** actions (not only retain/review).
4. **Execute** — DML runs in BigQuery.
5. **Audit** — **After (live re-scan)** should be **less than before** when deletes/anonymizes removed matches from BQ rows.

Retain-only runs keep **after = before** (payments rows stay by policy).

## 6. Cloud Run (optional)

In Terraform / Cloud Run env, set the same variables and grant the runtime service account `bigquery.dataEditor` only if using `bigquery_full`. See [cloud-run-deployment.md](cloud-run-deployment.md).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Execute: `local_json` in status | Set `CONSENTOPS_WAREHOUSE_MODE=bigquery_full` and restart |
| Execute fails with permission error | Add `bigquery.dataEditor` + `jobUser` |
| After count unchanged after deletes | You are on `bigquery_scan` (execute local only) — switch to `bigquery_full` |
| Fivetran 0 connections | Create a connector in Fivetran dashboard; re-scan |
| Scan 0 matches | Run `npm run bigquery:setup`; check `GOOGLE_CLOUD_PROJECT` / `BIGQUERY_DATASET` |
| Demo subject rejected | Keep `DEMO_MODE=true`; subject must be synthetic `subj_ana_reyes` |

## Modes reference

| `CONSENTOPS_WAREHOUSE_MODE` | Scan | Execute / verify |
|-----------------------------|------|-------------------|
| `local_json` | Local | Local |
| `bigquery_scan` | BigQuery | Local (after count stays 37 on BQ re-scan) |
| **`bigquery_full`** | **BigQuery** | **BigQuery** |

For your goal (Fivetran + cleanup in BigQuery), use **`bigquery_full`**.
