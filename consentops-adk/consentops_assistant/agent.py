import os
from pathlib import Path

import requests
from google.adk.agents import Agent
from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

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

_instruction = _INSTRUCTION_PATH.read_text(encoding="utf-8")


def _subject_payload(full_name: str = "", email: str = "") -> dict:
    subject = {}
    if full_name.strip():
        subject["fullName"] = full_name.strip()
    if email.strip():
        subject["email"] = email.strip()
    return {"subject": subject} if subject else {}


def _post_consentops(path: str, full_name: str = "", email: str = "") -> dict:
    """POST to ConsentOps agent API with one retry on transient Cloud Run errors."""
    url = f"{_CONSENTOPS_API}{path}"
    payload = _subject_payload(full_name, email)
    last_error: dict | str | None = None

    for attempt in range(2):
        try:
            response = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            if response.ok:
                return response.json()
            last_error = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            if response.status_code not in (500, 502, 503, 504) or attempt == 1:
                response.raise_for_status()
        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt == 1:
                raise

    return {
        "error": f"ConsentOps API failed after retry: {path}",
        "details": last_error,
        "retryHint": "Cloud Run may be cold-starting or running Fivetran MCP + BigQuery scan. Retry once.",
    }


def consentOpsScanWarehouse(full_name: str, email: str):
    """Scan synthetic warehouse for subject data spread (no Gemini plan).

    Call after Fivetran MCP pipeline discovery. Returns match counts, spread map,
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


def _build_fivetran_mcp_toolset() -> McpToolset | None:
    api_key = os.environ.get("FIVETRAN_API_KEY", "").strip()
    api_secret = os.environ.get("FIVETRAN_API_SECRET", "").strip()
    if not api_key or not api_secret:
        return None

    command = os.environ.get("FIVETRAN_MCP_COMMAND", "uvx").strip() or "uvx"
    args_from_env = os.environ.get("FIVETRAN_MCP_ARGS", "").strip()
    args = (
        args_from_env.split()
        if args_from_env
        else ["--from", "git+https://github.com/fivetran/fivetran-mcp", "fivetran-mcp"]
    )

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


def _build_tools() -> list:
    tools: list = [
        FunctionTool(consentOpsScanWarehouse),
        FunctionTool(consentOpsBuildPlan),
    ]
    mcp_toolset = _build_fivetran_mcp_toolset()
    if mcp_toolset is not None:
        tools.insert(0, mcp_toolset)
    return tools


root_agent = Agent(
    name="consentops_assistant",
    model=os.environ.get("ADK_GEMINI_MODEL") or "gemini-2.5-flash",
    description=(
        "Read-only ConsentOps helper: discover Fivetran pipelines via MCP, scan "
        "synthetic warehouse, propose classified cleanup. Execution requires the web UI."
    ),
    instruction=_instruction,
    tools=_build_tools(),
)
