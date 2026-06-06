# ConsentOps ADK chat front-end

Local [Google ADK](https://google.github.io/adk-docs/) agent that calls the hosted ConsentOps read-only API. Uses a `FunctionTool` wrapper around `POST /api/agent/plan` (same contract as [consentops-agent-cloudrun.yaml](../docs/openapi/consentops-agent-cloudrun.yaml)). Use this when **Vertex AI Agent Builder Studio** only offers MCP / built-in tools (no OpenAPI import in the Flow UI).

| Chat (scan + plan) | ADK Web UI + `consentOpsScanAndPlan` |
| Approve → execute → audit | [ConsentOps dashboard](https://consentops-agent-538209538110.us-central1.run.app) |

## Prerequisites

- Python 3.10+
- `pip install -r requirements.txt` (or `pip install google-adk`)
- `GEMINI_API_KEY` — Gemini calls for the ADK agent itself (separate from Cloud Run)

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

Expect a tool call to `consentOpsScanAndPlan` with `{}`, then an exact record count from `summaryForAgent.recordsFound` (BigQuery on Cloud Run is typically **29**; local JSON fixtures are **37**), Fivetran read-only summary, then a link to the web UI for approval.

## Layout

```
consentops-adk/
  consentops_assistant/
    agent.py          # root_agent + consentOpsScanAndPlan FunctionTool
  requirements.txt
```

OpenAPI spec and system prompt live under `docs/` (single source of truth).

See [docs/agent-builder-setup.md](../docs/agent-builder-setup.md) for the full demo script and troubleshooting.

**Automated deploy:** `infra/terraform` (staging bucket) + `./scripts/deploy-adk-agent-engine.sh`
