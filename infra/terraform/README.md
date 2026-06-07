# Terraform — Cloud Run (ConsentOps demo)

Infrastructure as code for the hackathon **Cloud Run** deployment. Synthetic demo only; no real PII.

## What Terraform manages

| Resource | Purpose |
|----------|---------|
| API enablement | Cloud Run, Artifact Registry, Secret Manager, IAM |
| Artifact Registry (optional) | Docker repo for `consentops-agent` image |
| Service account | Cloud Run runtime identity |
| Secret Manager secret (optional) | **Container only** — secret **value** added via `gcloud`, never in git |
| Cloud Run v2 service | Port 8080, `max_instances=1`, demo env vars |
| IAM | Public `run.invoker` when `allow_unauthenticated=true` |
| GCS bucket (optional) | ADK Agent Engine staging (`create_adk_staging_bucket`, default `true`) |
| Vertex AI API | Enabled for `adk deploy agent_engine` |

Terraform does **not** build the Docker image or run `adk deploy`. Build/push the app image locally; deploy the ADK agent with [scripts/deploy-adk-agent-engine.sh](../../scripts/deploy-adk-agent-engine.sh).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- `gcloud` authenticated with permission to enable APIs and deploy Cloud Run
- Docker (to build the app image)

## Quick start

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set project_id and container_image

terraform init
terraform plan
terraform apply
```

Note the output `cloud_run_url` and paste it into [README](../../README.md) platform proof section.

## Build and push image (before or after first apply)

If `create_artifact_registry = true`, Terraform creates the repo. **Automated deploy** (recommended):

```bash
# From repo root — builds Dockerfile, pushes to Artifact Registry, updates Cloud Run
python scripts/deploy_cloud_run.py
# or: ./scripts/deploy-cloud-run.sh
```

Options: `--dry-run`, `--skip-build`, `--skip-smoke`, `--tag v20250603`. Config from `.env` and `terraform output`.

Manual equivalent:

```bash
# Must run from repo root (ConsentOps-Agent/), where Dockerfile lives
cd /path/to/ConsentOps-Agent
export PROJECT_ID=rapid-agent-hackathon-26
export REGION=us-central1
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/consentops/consentops-agent:latest"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
docker build -t "$IMAGE" -f Dockerfile .
docker push "$IMAGE"
gcloud run services update consentops-agent --image="$IMAGE" --region="$REGION" --project="$PROJECT_ID"
```

Set `container_image = "$IMAGE"` in `terraform.tfvars` for the **first** apply only; ongoing image updates use `deploy_cloud_run.py` (Terraform ignores image drift).

## ADK Agent Engine deploy

Terraform creates a staging bucket (default `{project_id}-consentops-adk-staging`) and enables `aiplatform.googleapis.com`. The **agent code deploy** uses the ADK CLI (Terraform cannot reliably replace `adk deploy` — it generates `class_methods` and packaging).

```bash
cd infra/terraform && terraform apply && cd ../..
./scripts/deploy-adk-agent-engine.sh
```

Outputs: `adk_staging_bucket`, `adk_deploy_command`. After first deploy, save the reasoning engine id to `consentops-adk/.agent_engine_id` (script tries to capture it automatically). See [agent-builder-setup.md](../../docs/agent-builder-setup.md).

## Optional Gemini secret (three-step)

Cloud Run needs a secret **version**, not just an empty Secret Manager resource. Terraform never stores the key value.

1. Set in `terraform.tfvars`:

   ```hcl
   enable_gemini_secret = true
   mount_gemini_secret  = false
   ```

2. `terraform apply` — creates the secret resource + IAM; Cloud Run stays on deterministic planner until step 4.

3. Add the secret **value** outside Terraform (load from `.env` first — `$GEMINI_API_KEY` must be non-empty):

   ```bash
   cd ~/Projects/ConsentOps-Agent
   set -a && source .env && set +a
   test -n "$GEMINI_API_KEY" || echo "ERROR: GEMINI_API_KEY empty in .env"

   echo -n "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY \
     --project PROJECT_ID \
     --data-file=-
   ```

4. Mount on Cloud Run:

   ```hcl
   mount_gemini_secret = true
   ```

   Then `terraform apply` again (new revision picks up `GEMINI_API_KEY:latest`).

### `Secret .../versions/latest was not found`

You set `enable_gemini_secret = true` (or old config mounted the secret) before adding a version with `gcloud secrets versions add`. Fix: add the version (step 3), keep `mount_gemini_secret = false` until then, then set `mount_gemini_secret = true` and re-apply.

## State and secrets

- `terraform.tfvars` and `*.tfstate*` are gitignored.
- Do not put `GEMINI_API_KEY` in `.tfvars` or Terraform variables in CI logs.
- Prefer local state for hackathon; use a GCS backend for team use:

  ```hcl
  # backend.tf (optional, not committed with bucket name unless shared)
  terraform {
    backend "gcs" {
      bucket = "YOUR_TF_STATE_BUCKET"
      prefix = "consentops-agent"
    }
  }
  ```

## Troubleshooting

### `Artifact Registry API has not been used ... or it is disabled` (403)

**Most common cause:** `container_image` still uses the example placeholder `my-gcp-project`. Cloud Run then validates the image against a **different** GCP project (the numeric id in the error, e.g. `582867146070`), not your `project_id`. Fix the URI to match your project:

```hcl
container_image = "us-central1-docker.pkg.dev/rapid-agent-hackathon-26/consentops/consentops-agent:latest"
```

Run `terraform output suggested_image_uri` after apply for the exact string.

**Also required:** build and push the image before Cloud Run can start (empty registry repo is not enough):

```bash
cd /path/to/ConsentOps-Agent   # repo root — not infra/terraform
export IMAGE="us-central1-docker.pkg.dev/rapid-agent-hackathon-26/consentops/consentops-agent:latest"
gcloud auth configure-docker us-central1-docker.pkg.dev
docker build -t "$IMAGE" -f Dockerfile .
docker push "$IMAGE"
cd infra/terraform && terraform apply
```

If the URI is correct but propagation is slow, enable APIs explicitly, wait 2–5 minutes, and re-apply:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com \
  --project=YOUR_PROJECT_ID
```

## Destroy

```bash
terraform destroy
```

Removes Cloud Run service and optional registry/secret resources created by this module.

## Related docs

- [Cloud Run deployment (gcloud)](../../docs/cloud-run-deployment.md)
- [Platform proof plan](../../docs/platform-proof-plan.md)
