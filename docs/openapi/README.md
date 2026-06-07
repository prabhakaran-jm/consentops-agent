# ConsentOps Agent — OpenAPI and tool import

Read-only agent API for hackathon judges, **Vertex AI Agent Builder**, and ADK integrators.

| File | Purpose |
|------|---------|
| [consentops-agent.yaml](./consentops-agent.yaml) | Full OpenAPI 3.1 — local + Cloud Run servers |
| [consentops-agent-cloudrun.yaml](./consentops-agent-cloudrun.yaml) | Trimmed import for Agent Builder (hosted server only) |
| [../agent-builder-setup.md](../agent-builder-setup.md) | ADK + Agent Engine setup |
| [../agent-builder-system-prompt.txt](../agent-builder-system-prompt.txt) | System instructions |

## Two-step agent workflow

| Step | Operation | Endpoint | Capability |
|------|-----------|----------|------------|
| 1 | `consentOpsScanWarehouse` | `POST /api/agent/scan` | `scan_only` |
| 2 | `consentOpsBuildPlan` | `POST /api/agent/plan` | `plan_only` |

**Does not:** execute cleanup, accept approval tokens, trigger Fivetran syncs, or certify compliance.

**Synthetic data only.**

## Quick test

```bash
# Step 1 — scan
curl -s -X POST http://localhost:3000/api/agent/scan \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.capability, .scan.matchCount'

# Step 2 — plan (after scan)
curl -s -X POST http://localhost:3000/api/agent/plan \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.capability, .source, (.plan.actions | length)'
```

Expected locally (no `GEMINI_API_KEY`): `scan_only`, `37`, then `plan_only`, `deterministic`, `37`.

## Import as agent tools

1. Host ConsentOps (local or Cloud Run).
2. Register **both** operations from the spec (or use ADK `agent.py`, which already wraps them).
3. System prompt: [agent-builder-system-prompt.txt](../agent-builder-system-prompt.txt).
4. Human approval and execution: ConsentOps web UI only.

## Validation

- Routes: [src/app/api/agent/scan/route.ts](../../src/app/api/agent/scan/route.ts), [src/app/api/agent/plan/route.ts](../../src/app/api/agent/plan/route.ts)
- Tests: [tests/agentScanRoute.test.ts](../../tests/agentScanRoute.test.ts), [tests/agentPlanRoute.test.ts](../../tests/agentPlanRoute.test.ts), [tests/openapiAgentSpec.test.ts](../../tests/openapiAgentSpec.test.ts)

## Security

- No API keys in this spec; server-side env / Secret Manager only.
- Do not commit secrets or raw production Fivetran IDs.
