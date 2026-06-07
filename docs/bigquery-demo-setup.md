# BigQuery synthetic demo warehouse

Load the **same fictional Ana Reyes records** as `src/lib/demo/seedData.ts` into BigQuery. Do not load real personal data.

## Automated setup (recommended)

### Prerequisites

- `gcloud auth application-default login --project=YOUR_PROJECT_ID`
- BigQuery permissions: **BigQuery Admin** (or Data Editor + Job User) on the project
- In `.env.local` (or `.env`):

  ```env
  GOOGLE_CLOUD_PROJECT=your-project
  BIGQUERY_DATASET=consentops_demo
  CONSENTOPS_WAREHOUSE_MODE=bigquery_scan
  ```

### One command

From the repo root:

```bash
npm install
npm run bigquery:setup:dry-run   # preview only
npm run bigquery:setup           # create dataset, tables, load all fixture rows
```

The script:

1. Creates dataset `BIGQUERY_DATASET` (location `US`, override with `--location=EU`)
2. Creates seven demo tables (schema in `scripts/bigquery/demo-schema.sql`)
3. Truncates existing demo tables (idempotent re-runs)
4. Inserts every row from `demoWarehouseTables` in `seedData.ts` with matching **record ids**

Then restart the app and run the UI scan — you should see `scanSource: "bigquery"` on `/api/scan` when mode is `bigquery_scan` or `bigquery_full`.

### Verify row counts

```bash
bq query --use_legacy_sql=false "
SELECT 'crm_customers' AS table, COUNT(*) AS rows FROM \`PROJECT.consentops_demo.crm_customers\`
UNION ALL SELECT 'commerce_orders', COUNT(*) FROM \`PROJECT.consentops_demo.commerce_orders\`
"
```

Expect **37** Ana Reyes matches on scan with local JSON fixtures. Hosted BigQuery on Cloud Run typically returns **25** matches (same subject, live warehouse rows).

## Manual setup (optional)

If you prefer SQL only:

```bash
export PROJECT_ID=your-project
export DATASET=consentops_demo
bq mk --dataset --location=US "${PROJECT_ID}:${DATASET}"
bq query --project_id="${PROJECT_ID}" --use_legacy_sql=false < scripts/bigquery/demo-schema.sql
```

Then load rows manually or re-run `npm run bigquery:setup`.

## App modes

| `CONSENTOPS_WAREHOUSE_MODE` | Scan | Execute |
|-----------------------------|------|---------|
| `local_json` | Local JSON | Local JSON |
| `bigquery_scan` | BigQuery | Local JSON (ids must match BQ load) |
| `bigquery_full` | BigQuery | BigQuery DML |

For execute + verify on BigQuery:

```env
CONSENTOPS_WAREHOUSE_MODE=bigquery_full
```

For **Fivetran live connectors + BigQuery cleanup** (partner-track narrative), see [fivetran-bigquery-demo.md](fivetran-bigquery-demo.md).

## Cloud Run IAM

Grant the runtime service account:

- `roles/bigquery.dataViewer` — scan
- `roles/bigquery.dataEditor` — only for `bigquery_full`
- `roles/bigquery.jobUser` — run queries

## Demo safety

When `DEMO_MODE=true` or `CONSENTOPS_DEMO_MODE=true`, warehouse operations are restricted to synthetic subject `subj_ana_reyes`.
