# BigQuery synthetic demo warehouse

Load the **same fictional Ana Reyes records** as `src/lib/demo/seedData.ts` into BigQuery. Do not load real personal data.

## Automated setup

### Prerequisites

- `gcloud auth application-default login --project=YOUR_PROJECT_ID`
- BigQuery permissions: **BigQuery Admin** (or Data Editor + Job User)
- In `.env.local`:

  ```env
  GOOGLE_CLOUD_PROJECT=your-project
  BIGQUERY_DATASET=consentops_demo
  CONSENTOPS_WAREHOUSE_MODE=bigquery_full
  ```

### Load fixtures

```bash
npm install
npm run bigquery:setup:dry-run   # preview
npm run bigquery:setup           # create dataset, tables, load rows
```

Creates dataset `BIGQUERY_DATASET`, seven tables (`scripts/bigquery/demo-schema.sql`), and inserts all rows from `seedData.ts`.

Restart the app and scan — expect `scanSource: "bigquery"`. Hosted Cloud Run typically returns **25** matches for Ana Reyes; local JSON fixtures return **37**.

## Warehouse modes

| `CONSENTOPS_WAREHOUSE_MODE` | Scan | Execute / verify |
|-----------------------------|------|-------------------|
| `local_json` | Local JSON | Local JSON |
| `bigquery_scan` | BigQuery | Local JSON |
| **`bigquery_full`** | **BigQuery** | **BigQuery DML** |

Use **`bigquery_full`** when you want the audit **after** count to drop after approved deletes/anonymizes.

## Fivetran + BigQuery (optional)

Fivetran connectors provide the **ingestion story**; cleanup targets **`consentops_demo`** (loaded above). You do not need Fivetran to replicate into that dataset for the demo flow.

```env
FIVETRAN_API_KEY=your_key
FIVETRAN_API_SECRET=your_secret
FIVETRAN_MCP_RUNTIME=true
FIVETRAN_ALLOW_WRITES=false
```

See [fivetran-mcp.md](./fivetran-mcp.md) for MCP setup. If the connector panel shows **0 connections**, add a connector in the [Fivetran dashboard](https://fivetran.com/dashboard) and scan again.

**End-to-end:** Scan → Generate plan (Step 4) → Approve → Execute → Audit. Platform status should show `Warehouse: bigquery_full`, `Fivetran: live_read_only` or `mcp_runtime`.

## IAM (Cloud Run or local ADC)

| Role | Purpose |
|------|---------|
| `roles/bigquery.dataViewer` | Scan |
| `roles/bigquery.dataEditor` | Execute (`bigquery_full` only) |
| `roles/bigquery.jobUser` | Run queries |

When `DEMO_MODE=true` or `CONSENTOPS_DEMO_MODE=true`, operations are restricted to synthetic subject `subj_ana_reyes`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Execute uses `local_json` | Set `CONSENTOPS_WAREHOUSE_MODE=bigquery_full` and restart |
| Permission errors on execute | Add `bigquery.dataEditor` + `jobUser` |
| After count unchanged after deletes | Likely on `bigquery_scan` — switch to `bigquery_full` |
| Scan 0 matches | Run `npm run bigquery:setup`; check project/dataset env vars |

Deploy with the same env on Cloud Run: [cloud-run-deployment.md](./cloud-run-deployment.md).
