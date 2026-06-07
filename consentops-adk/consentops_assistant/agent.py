import os
from pathlib import Path

import requests
from google.adk.agents import Agent
from google.adk.tools.function_tool import FunctionTool

# NOTE: MCP imports (McpToolset, StdioConnectionParams, mcp) are intentionally
# deferred into _build_fivetran_mcp_toolset(). Building a stdio McpToolset at
# module import spawns the fivetran-mcp subprocess and destabilizes the Vertex
# AI Agent Engine runtime ("does not have running instances"). On Agent Engine
# we set ADK_FIVETRAN_MCP_ENABLED=false and use Cloud Run-backed FunctionTools
# that proxy read-only Fivetran MCP calls without fastmcp/httpx in this venv.

_AGENT_DIR = Path(__file__).resolve().parent
_INSTRUCTION_PATH = _AGENT_DIR / "instructions.txt"
_CONSENTOPS_API = os.environ.get(
    "CONSENTOPS_API_BASE_URL",
    "https://consentops-agent-538209538110.us-central1.run.app",
).rstrip("/")

FIVETRAN_READ_ONLY_TOOLS = [
    "get_account_info",
    "list_connections",
    "get_connection_details",
    "get_connection_state",
    "list_destinations",
]

_LIST_CONNECTIONS_SCHEMA = "open-api-definitions/connections/list_connections.json"

_instruction = _INSTRUCTION_PATH.read_text(encoding="utf-8")


def _subject_payload(full_name: str = "", email: str = "") -> dict:
    subject = {}
    if full_name.strip():
        subject["fullName"] = full_name.strip()
    if email.strip():
        subject["email"] = email.strip()
    return {"subject": subject} if subject else {}


def _post_json(path: str, payload: dict, *, retry_on_transient: bool = True) -> dict:
    """POST JSON to ConsentOps Cloud Run with optional retry on transient errors."""
    url = f"{_CONSENTOPS_API}{path}"
    last_error: dict | str | None = None
    attempts = 2 if retry_on_transient else 1

    for attempt in range(attempts):
        try:
            response = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            if response.ok:
                return response.json()
            last_error = (
                response.json()
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            )
            if response.status_code not in (500, 502, 503, 504) or attempt == attempts - 1:
                response.raise_for_status()
        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt == attempts - 1:
                raise

    return {
        "error": f"ConsentOps API failed after retry: {path}",
        "details": last_error,
        "retryHint": "Cloud Run may be cold-starting. Retry once.",
    }


def _post_consentops(path: str, full_name: str = "", email: str = "") -> dict:
    return _post_json(path, _subject_payload(full_name, email))


def _post_fivetran_tool(tool: str, arguments: dict | None = None) -> dict:
    """Proxy a read-only Fivetran MCP tool through ConsentOps Cloud Run."""
    return _post_json(
        "/api/agent/fivetran",
        {"tool": tool, "arguments": arguments or {}},
    )


def get_account_info():
    """Read-only Fivetran account metadata (no syncs or writes).

    Returns:
        Cloud Run JSON with account info from Fivetran MCP runtime or adapter fallback.
    """
    return _post_fivetran_tool("get_account_info")


def list_connections(
    schema_file: str = _LIST_CONNECTIONS_SCHEMA,
):
    """List Fivetran connections in read-only mode (no syncs or writes).

    Args:
        schema_file: OpenAPI schema path for list_connections (default matches Fivetran MCP).

    Returns:
        Cloud Run JSON with connection items and health metadata.
    """
    return _post_fivetran_tool("list_connections", {"schema_file": schema_file})


def get_connection_details(connection_id: str):
    """Read-only details for one Fivetran connection (no syncs or writes).

    Args:
        connection_id: Connection id from list_connections.

    Returns:
        Cloud Run JSON with connector service, schema, sync timestamps, and health.
    """
    return _post_fivetran_tool(
        "get_connection_details",
        {"connection_id": connection_id.strip()},
    )


def get_connection_state(connection_id: str):
    """Read-only sync/state snapshot for one connection (no sync triggers).

    Args:
        connection_id: Connection id from list_connections.

    Returns:
        Cloud Run JSON with sync state. On HTTP 405 from live MCP, report state
        unavailable and continue — no sync was triggered.
    """
    return _post_fivetran_tool(
        "get_connection_state",
        {"connection_id": connection_id.strip()},
    )


def list_destinations():
    """List Fivetran destinations in read-only mode (no syncs or writes).

    Returns:
        Cloud Run JSON with destination ids/types (e.g. BigQuery).
    """
    return _post_fivetran_tool("list_destinations")


def consentOpsScanWarehouse(full_name: str, email: str):
    """Scan synthetic warehouse for subject data spread (no Gemini plan).

    Call after Fivetran pipeline discovery. Returns match counts, spread map,
    and Fivetran connector summary. Does not execute deletions or syncs.

    Args:
        full_name: Synthetic subject name. Pass empty string for demo subject Ana Reyes.
        email: Synthetic subject email. Pass empty string for demo subject Ana Reyes.

    Returns:
        API JSON: capability scan_only, disclaimer, scan, summaryForAgent.
    """
    return _post_consentops("/api/agent/scan", full_name, email)


def consentOpsBuildPlan(full_name: str, email: str):
    """Build classified cleanup plan from the latest warehouse scan.

    Call after consentOpsScanWarehouse. Returns Gemini or deterministic plan with
    per-record classifications. Does not execute deletions or syncs.

    Args:
        full_name: Synthetic subject name. Pass empty string for demo subject Ana Reyes.
        email: Synthetic subject email. Pass empty string for demo subject Ana Reyes.

    Returns:
        API JSON: capability plan_only, disclaimer, plan, source, blockedActions, summaryForAgent.
    """
    return _post_consentops("/api/agent/plan", full_name, email)


def _fivetran_mcp_enabled() -> bool:
    """Native stdio MCP is on by default locally. Agent Engine deploy sets
    ADK_FIVETRAN_MCP_ENABLED=false (fastmcp/httpx conflict). Cloud Run FunctionTools
    provide read-only Fivetran trace parity when native MCP is off."""
    return os.environ.get("ADK_FIVETRAN_MCP_ENABLED", "true").lower() in ("1", "true", "yes")


def _build_fivetran_mcp_toolset():
    if not _fivetran_mcp_enabled():
        return None

    api_key = os.environ.get("FIVETRAN_API_KEY", "").strip()
    api_secret = os.environ.get("FIVETRAN_API_SECRET", "").strip()
    if not api_key or not api_secret:
        return None

    try:
        from google.adk.tools.mcp_tool import McpToolset
        from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
        from mcp import StdioServerParameters

        command = os.environ.get("FIVETRAN_MCP_COMMAND", "uvx").strip() or "uvx"
        args_from_env = os.environ.get("FIVETRAN_MCP_ARGS", "").strip()
        if args_from_env:
            args = args_from_env.split()
        elif command in ("uvx", "uv"):
            args = ["--from", "git+https://github.com/fivetran/fivetran-mcp", "fivetran-mcp"]
        else:
            args = []

        return McpToolset(
            connection_params=StdioConnectionParams(
                server_params=StdioServerParameters(
                    command=command,
                    args=args,
                    env={
                        "FIVETRAN_API_KEY": api_key,
                        "FIVETRAN_API_SECRET": api_secret,
                        "FIVETRAN_ALLOW_WRITES": "false",
                    },
                ),
                timeout=120,
            ),
            tool_filter=FIVETRAN_READ_ONLY_TOOLS,
        )
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, keep engine up
        print(f"Fivetran MCP toolset disabled (setup failed): {exc}")
        return None


def _build_cloud_fivetran_tools() -> list:
    return [
        FunctionTool(get_account_info),
        FunctionTool(list_connections),
        FunctionTool(get_connection_details),
        FunctionTool(get_connection_state),
        FunctionTool(list_destinations),
    ]


def _build_tools() -> list:
    scan_plan = [
        FunctionTool(consentOpsScanWarehouse),
        FunctionTool(consentOpsBuildPlan),
    ]
    mcp_toolset = _build_fivetran_mcp_toolset()
    if mcp_toolset is not None:
        return [mcp_toolset] + scan_plan
    return _build_cloud_fivetran_tools() + scan_plan


root_agent = Agent(
    name="consentops_assistant",
    model=os.environ.get("ADK_GEMINI_MODEL") or "gemini-2.5-flash",
    description=(
        "Read-only ConsentOps helper: discover Fivetran pipelines, scan synthetic "
        "warehouse, propose classified cleanup. Execution requires the web UI."
    ),
    instruction=_instruction,
    tools=_build_tools(),
)
