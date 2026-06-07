# ConsentOps ADK chat front-end

Local [Google ADK](https://google.github.io/adk-docs/) agent with **native Fivetran MCP** (read-only) plus ConsentOps scan/plan tools against the hosted API.

| Chat (MCP + scan + plan) | ADK Web UI — Fivetran MCP tools + `consentOpsScanWarehouse` + `consentOpsBuildPlan` |
| Approve → execute → audit | [ConsentOps dashboard](https://consentops-agent-538209538110.us-central1.run.app) |

## Prerequisites

- Python 3.10+
- `pip install -r consentops_assistant/requirements.txt`
- `GEMINI_API_KEY` — Gemini calls for the ADK agent itself (separate from Cloud Run)
- `FIVETRAN_API_KEY` + `FIVETRAN_API_SECRET` — enables Fivetran MCP toolset locally (read-only; `FIVETRAN_ALLOW_WRITES=false` on MCP server)
- [uv](https://docs.astral.sh/uv/) on PATH for `uvx` to spawn Fivetran MCP (same as Cloud Run Docker image)

```bash
export GEMINI_API_KEY=your_key   # Git Bash
# or set in consentops-adk/.env if your ADK version loads it
```

## Run

From the **repo root** (recommended):

```bash
adk web consentops-adk --port 8081
```

Open http://127.0.0.1:8081 and select **consentops_assistant**.

### Port 8000 fails on Windows?

Default ADK port **8000** is often taken (e.g. Splunk). Always pass `--port 8081` (or `8888`).

```bash
netstat -ano | findstr :8000   # see what is listening
adk web consentops-adk --port 8081
```

## Try in chat

> Scan the demo subject and summarize where data spread. Propose cleanup at a high level — do not execute anything.

Expect MCP discovery tools (when credentials set), then `consentOpsScanWarehouse` and `consentOpsBuildPlan`. Quote exact `summaryForAgent.recordsFound` (BigQuery on Cloud Run is typically **25**; local JSON **37**), then link to the web UI for approval.

## Layout

```
consentops-adk/
  consentops_assistant/
    agent.py          # root_agent + Fivetran McpToolset + ConsentOps FunctionTools
    instructions.txt
  requirements.txt
```

OpenAPI spec and system prompt live under `docs/` (single source of truth).

## Troubleshooting

| Log / symptom | Meaning |
|---------------|---------|
| `auth_config or auth_config.auth_scheme is missing` (many lines) | **Harmless ADK noise** when Fivetran MCP tools use env API keys instead of OAuth. Tools still run. |
| `Default value is not supported in function declaration schema` | **Harmless** for local `adk web` + Gemini API; tools use required `full_name` / `email` args (pass `""` for Ana Reyes). |
| `500` / `503` on `consentOpsScanWarehouse` | Transient Cloud Run cold start or MCP+BigQuery load. Agent retries once; start a new session if it persists. |

See [docs/agent-builder-setup.md](../docs/agent-builder-setup.md) for the full demo script and Agent Engine deploy.

## Agent Engine deploy (Step 2)

From repo root, after `terraform apply` (staging bucket) and Fivetran secrets in Secret Manager:

```bash
# Git Bash / Linux — always --recreate after agent.py or requirements.txt changes
ADK_RECREATE=true ./scripts/deploy-adk-agent-engine.sh --recreate
```

```powershell
# PowerShell
$env:ADK_RECREATE = "true"
python scripts/deploy_adk_agent_engine.py --recreate
```

The deploy script sets `CONSENTOPS_API_BASE_URL`, deploys with `min_instances=1`
(so the Playground always has a warm instance), and runs a `create_session` smoke
test — the deploy returns non-zero if the engine has no running instance within 5 min.

### Fivetran MCP: ON locally, OFF on Agent Engine (by design)

Local `adk web` runs the full read-only MCP toolset (`get_account_info` …
`list_destinations`) by fetching the server via `uvx` in an **isolated** env.

On **Agent Engine** native stdio MCP is off (`ADK_FIVETRAN_MCP_ENABLED=false`) — adding
`fivetran-mcp` to `requirements.txt` pulls `fastmcp>=2.0.0` + `httpx>=0.28` into the
agent venv, which conflicts with the `google-adk`/`google-genai`/`aiplatform` runtime and
crashes the worker (`does not have running instances` — confirmed by the deploy smoke
test). Agent Engine has no `uvx` to isolate the server.

Instead, the Engine agent registers **Cloud Run-backed FunctionTools** with the same
read-only names (`get_account_info` … `list_destinations`). Each call hits
`POST /api/agent/fivetran` on Cloud Run, where Fivetran MCP runs in an isolated runtime
(no fastmcp/httpx in the Engine venv). Playground traces show the 5-tool discovery chain
plus `consentOpsScanWarehouse` and `consentOpsBuildPlan`.

The agent's MCP build is also **fail-safe** (any setup error degrades to scan+plan),
and the deploy's smoke test fails fast if a future change ever takes the engine down.
(The separate, earlier `does not have running instances` error was a missing
`roles/aiplatform.user` IAM binding — see below.)

### Required APIs and IAM (one-time)

`GOOGLE_CLOUD_PROJECT` is **reserved** on Agent Engine and cannot be set; the deploy
passes `CLOUD_ML_PROJECT_ID` instead and relies on Cloud Resource Manager:

```bash
gcloud services enable cloudresourcemanager.googleapis.com aiplatform.googleapis.com \
  --project=rapid-agent-hackathon-26

# REQUIRED: the custom runtime SA needs aiplatform.sessions.* for the managed
# session service. Without this, create_session returns 403 PERMISSION_DENIED and
# the Playground reports "does not have running instances".
RUNTIME_SA=consentops-agent-run@rapid-agent-hackathon-26.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding rapid-agent-hackathon-26 \
  --member=serviceAccount:$RUNTIME_SA --role=roles/aiplatform.user --condition=None

# Only if you enable MCP on Engine (ADK_FIVETRAN_MCP_ENABLED=true):
gcloud secrets add-iam-policy-binding FIVETRAN_API_KEY \
  --member=serviceAccount:$RUNTIME_SA --role=roles/secretmanager.secretAccessor \
  --project=rapid-agent-hackathon-26
gcloud secrets add-iam-policy-binding FIVETRAN_API_SECRET \
  --member=serviceAccount:$RUNTIME_SA --role=roles/secretmanager.secretAccessor \
  --project=rapid-agent-hackathon-26
```

`--recreate` deletes the existing engine (from `.agent_engine_id`) before create;
required after any `agent.py` / `requirements.txt` change because `update()` does
not rebuild the container.

**Automated deploy:** `infra/terraform` (staging bucket) + `./scripts/deploy-adk-agent-engine.sh --recreate`
