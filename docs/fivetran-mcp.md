# Fivetran MCP integration (read-only)

ConsentOps uses the [Fivetran MCP server](https://github.com/fivetran/fivetran-mcp) for **read-only** pipeline discovery. Cleanup runs on the synthetic warehouse (BigQuery or local JSON) after human approval — never through MCP or Fivetran write APIs.

## Architecture

| Layer | Role |
|-------|------|
| **Fivetran MCP** | Agent + dashboard discovery: account, connections, destinations |
| **Fivetran REST** | UI connector panel when MCP runtime is off or spawn fails |
| **ConsentOps executor** | Approval-gated `DELETE` / `UPDATE` on explicit record IDs only |

## Setup

Use the same API key as the [Fivetran REST API](https://fivetran.com/docs/rest-api/getting-started#authentication).

```env
FIVETRAN_API_KEY=
FIVETRAN_API_SECRET=
FIVETRAN_ALLOW_WRITES=false
FIVETRAN_MCP_RUNTIME=true
```

Optional: `FIVETRAN_MCP_COMMAND`, `FIVETRAN_MCP_ARGS` (default spawns `uvx --from git+https://github.com/fivetran/fivetran-mcp fivetran-mcp`).

## Discovery tools (allowlisted)

During scan, the app runs these read-only tools in sequence (`src/lib/connectors/fivetranPipelineDiscovery.ts`):

1. `get_account_info`
2. `list_connections`
3. `get_connection_details`
4. `get_connection_state`
5. `list_destinations`

Agent Engine proxies the same tools via Cloud Run when native stdio MCP is disabled (`ADK_FIVETRAN_MCP_ENABLED=false`).

## Runtime behavior

| Environment | Source | Notes |
|-------------|--------|-------|
| Local `npm run dev` | `mcp_runtime` when flag + `uv` installed | `/api/status` → `fivetranIntegrationSource: "mcp_runtime"` |
| Cloud Run | `mcp_runtime` when configured | Dockerfile includes `uv`; REST fallback on spawn failure |
| No credentials | `mock` | `MockFivetranAdapter` — fictional connectors |

Implementation: `src/lib/connectors/fivetranMcpRuntime.ts`, `fivetranAgentBridge.ts`, `mcpFivetranAdapter.ts`.

## Do not invoke via MCP

- Sync triggers, connection create/update/delete
- Any cleanup or warehouse mutation

## Security

Never commit API keys, secrets, or raw Fivetran connection/account/destination IDs. Use sanitized aliases in docs and tests only.
