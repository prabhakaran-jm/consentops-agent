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

Expect MCP discovery tools (when credentials set), then `consentOpsScanWarehouse` and `consentOpsBuildPlan`. Quote exact `summaryForAgent.recordsFound` (BigQuery on Cloud Run is typically **29**; local JSON **37**), then link to the web UI for approval.

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

**Automated deploy:** `infra/terraform` (staging bucket) + `./scripts/deploy-adk-agent-engine.sh`
