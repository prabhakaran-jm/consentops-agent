# Cloud Run deployment

Deploy ConsentOps Agent as a container on [Google Cloud Run](https://cloud.google.com/run). The hackathon demo runs on **synthetic fixtures only** — do not load real personal data into this deployment.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed locally
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) authenticated
- A GCP project with Cloud Run and (optionally) Artifact Registry or Container Registry enabled

Replace placeholders below:

| Placeholder | Example |
|-------------|---------|
| `PROJECT_ID` | `my-gcp-project` |
| `REGION` | `us-central1` |
| `SERVICE_NAME` | `consentops-agent` |
| `IMAGE` | `us-central1-docker.pkg.dev/PROJECT_ID/consentops/consentops-agent` |

## Build the image

From the repository root:

```bash
docker build -t consentops-agent:local .
```

## Run locally

Cloud Run sets `PORT` automatically; the container listens on **8080** by default.

```bash
docker run --rm -p 8080:8080 \
  -e DEMO_MODE=true \
  -e CONSENTOPS_DEMO_MODE=true \
  consentops-agent:local
```

Open [http://localhost:8080](http://localhost:8080).

Optional runtime variables (omit for deterministic planning and mock adapters):

```bash
docker run --rm -p 8080:8080 \
  -e DEMO_MODE=true \
  -e CONSENTOPS_DEMO_MODE=true \
  -e GEMINI_MODEL=gemini-2.5-flash \
  consentops-agent:local
```

Pass sensitive values via your shell environment or a local env file **not committed to git** — never embed API keys in the Dockerfile or image layers.

## Deploy to Cloud Run

### Option A — build and push, then deploy

```bash
gcloud auth configure-docker REGION-docker.pkg.dev

docker build -t IMAGE:latest .
docker push IMAGE:latest

gcloud run deploy SERVICE_NAME \
  --project PROJECT_ID \
  --region REGION \
  --image IMAGE:latest \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --max-instances=1 \
  --set-env-vars DEMO_MODE=true,CONSENTOPS_DEMO_MODE=true
```

`--allow-unauthenticated` keeps the hosted demo publicly reachable. Public visitors **share the same in-memory demo state** on that instance. If the workflow gets into a confusing state during judging, **redeploy or restart** the service to reset.

### Option B — deploy from source (Cloud Build)

```bash
gcloud run deploy SERVICE_NAME \
  --project PROJECT_ID \
  --region REGION \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --max-instances=1 \
  --set-env-vars DEMO_MODE=true,CONSENTOPS_DEMO_MODE=true
```

Public demo visitors share one in-memory state per running instance; reset/redeploy if the demo state gets messy.

For production-like secrets (Gemini, Fivetran), use [Secret Manager](https://cloud.google.com/run/docs/configuring/secrets) with `--set-secrets` instead of plain env vars. Do not commit secret values to this repository.

### Option C — Terraform (IaC)

Declarative deploy with [infra/terraform](../../infra/terraform/README.md):

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit project_id and container_image (build/push image first)

terraform init
terraform plan
terraform apply
```

Outputs include `cloud_run_url`. Defaults include `max_instances = 1` and optional `enable_gemini_secret` in tfvars. Secret **values** are added with `gcloud`, not committed to git.

## Environment variables

| Variable | Hackathon demo | Notes |
|----------|----------------|-------|
| `DEMO_MODE` | `true` | Documents intended demo configuration |
| `CONSENTOPS_DEMO_MODE` | `true` | Same reserved flag (see README) |
| `GEMINI_API_KEY` | omit | Omit for deterministic planner |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Optional |
| `FIVETRAN_API_KEY` | omit | Real adapter is stubbed |
| `FIVETRAN_API_SECRET` | omit | Real adapter is stubbed |
| `GOOGLE_CLOUD_PROJECT` | omit | BigQuery adapter is stubbed |
| `BIGQUERY_DATASET` | omit | BigQuery adapter is stubbed |

See `.env.example` for the full list and comments.

## Demo mode deployment

For the hackathon demo, deploy with:

```bash
--set-env-vars DEMO_MODE=true,CONSENTOPS_DEMO_MODE=true
```

The app already uses synthetic local fixtures in `src/lib/demo/seedData.ts`. No Fivetran or BigQuery credentials are required for the default demo flow.

Optional: set `GEMINI_API_KEY` via Secret Manager if you want live Gemini planning with deterministic fallback on failure.

## Secret Manager for `GEMINI_API_KEY` (recommended)

Use Secret Manager instead of `--set-env-vars` for the Gemini key so it never appears in the Cloud Run console env list or git.

### Checklist

- [ ] Enable Secret Manager API in `PROJECT_ID`
- [ ] Create secret (example name: `GEMINI_API_KEY`):

```bash
echo -n "YOUR_GEMINI_KEY" | gcloud secrets create GEMINI_API_KEY \
  --project PROJECT_ID \
  --data-file=-
```

- [ ] Grant the Cloud Run **runtime service account** access:

```bash
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --project PROJECT_ID \
  --member="serviceAccount:RUNTIME_SA@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Replace `RUNTIME_SA` with the service account your Cloud Run service uses (default compute SA or a dedicated one).

- [ ] Deploy with secret reference (not plain env):

```bash
gcloud run deploy SERVICE_NAME \
  --project PROJECT_ID \
  --region REGION \
  --image IMAGE:latest \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --max-instances=1 \
  --set-env-vars DEMO_MODE=true,CONSENTOPS_DEMO_MODE=true,GEMINI_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

- [ ] Confirm the key is **not** in: Dockerfile, git, build logs, or `gcloud run services describe` env vars (only secret references)
- [ ] Confirm planner badge can show **Planned by Gemini** on the hosted URL after deploy
- [ ] Screenshot Secret Manager + Cloud Run revision for submission (values blurred)

**Never** commit `YOUR_GEMINI_KEY` or paste it into this repository.

## Demo state and Cloud Run scaling

ConsentOps demo workflow state (`latestPlan`, `latestAudit`, mutated warehouse tables) lives **in memory** inside the Node.js process — there is no durable database in this hackathon build.

- **Ephemeral** — state can reset on cold start, redeploy, or container restart.
- **Per instance** — each running Cloud Run instance has its own copy of state; load balancing across instances would split the scan → plan → execute → audit flow.
- **Judged demo recommendation** — deploy with `--max-instances=1` so the full workflow stays on one instance.
- **Demo constraint, not production architecture** — a real deployment would need durable state storage (database, object store, or similar) and explicit session or tenant isolation.

## Safety warning

- **Synthetic data only** — this project is a hackathon demo, not production compliance software.
- **Do not** point the demo at warehouses containing real personal data.
- **Do not** store API keys or connector secrets in the image, Dockerfile, or git.
- Destructive cleanup actions require explicit human approval in the app; preserve that model in any future production wiring.

## Verify after deploy

Get the service URL:

```bash
gcloud run services describe SERVICE_NAME \
  --project PROJECT_ID \
  --region REGION \
  --format='value(status.url)'
```

Walk through this checklist on the hosted URL (synthetic Ana Reyes fixture):

- [ ] Open the hosted URL in a browser
- [ ] Confirm the audit panel initially shows **No execution yet**
- [ ] Click **Scan data spread** and confirm matches appear (37 records for Ana Reyes)
- [ ] Confirm Fivetran connector cards appear in the connector panel
- [ ] Click **Generate cleanup plan** and confirm classified actions load
- [ ] Select one or more actions for approval
- [ ] Click **Execute approved cleanup** and confirm execution completes
- [ ] Confirm an audit report appears (not merely a self-reported count)
- [ ] Confirm the after count is based on a **live re-scan**, not a static fixture value
- [ ] Confirm **Platform status** card loads on the hosted URL

## Submission assets

- [Demo video script](demo-video-script.md)
- [Devpost copy](devpost-submission.md)
- [Platform proof plan](platform-proof-plan.md)
