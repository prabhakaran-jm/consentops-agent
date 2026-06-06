import os
from pathlib import Path

import requests
from google.adk.agents import Agent
from google.adk.tools.function_tool import FunctionTool
_AGENT_DIR = Path(__file__).resolve().parent
_INSTRUCTION_PATH = _AGENT_DIR / "instructions.txt"
_CONSENTOPS_API = "https://consentops-agent-538209538110.us-central1.run.app"

_instruction = _INSTRUCTION_PATH.read_text(encoding="utf-8")


def consentOpsScanAndPlan(full_name: str = "", email: str = ""):
    """Scan synthetic warehouse and generate a classified cleanup plan.

    Calls the hosted ConsentOps read-only API (scan → plan). Returns Fivetran
    connector summary, data spread counts, and cleanup actions. Does not execute
    deletions or syncs.

    Args:
        full_name: Optional synthetic subject name. Leave empty for demo subject Ana Reyes.
        email: Optional synthetic subject email. Leave empty for demo subject Ana Reyes.

    Returns:
        API JSON: capability, disclaimer, scan, plan, source, blockedActions.
    """
    body = {}
    subject = {}
    if full_name.strip():
        subject["fullName"] = full_name.strip()
    if email.strip():
        subject["email"] = email.strip()
    if subject:
        body["subject"] = subject

    response = requests.post(
        f"{_CONSENTOPS_API}/api/agent/plan",
        json=body,
        headers={"Content-Type": "application/json"},
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()

    scan = data.get("scan") or {}
    plan = data.get("plan") or {}
    actions = plan.get("actions") or []
    by_classification: dict[str, int] = {}
    for action in actions:
        key = str(action.get("classification", "unknown"))
        by_classification[key] = by_classification.get(key, 0) + 1

    spread_map = scan.get("spreadMap") or {}
    table_totals = {
        table: (entry or {}).get("totalMatches", 0)
        for table, entry in spread_map.items()
    }
    match_count = scan.get("matchCount", scan.get("beforeCount"))

    data["summaryForAgent"] = {
        "recordsFound": match_count,
        "spreadByTable": table_totals,
        "actionsByClassification": by_classification,
        "plannerSource": data.get("source"),
        "instruction": (
            "Use summaryForAgent.recordsFound as the authoritative record count. "
            "Do not approximate or cite fixture documentation."
        ),
    }
    return data


root_agent = Agent(
    name="consentops_assistant",
    # This agent only runs on Vertex AI Agent Engine (us-central1), where the
    # Cloud Run model gemini-3.5-flash is a 404 publisher model. Use the
    # Vertex-specific override ADK_GEMINI_MODEL (set in .env / deploy env_vars)
    # or a Vertex-valid default — never the Developer-API GEMINI_MODEL value,
    # which is read here at deploy/import time and baked into the agent.
    model=os.environ.get("ADK_GEMINI_MODEL") or "gemini-2.5-flash",
    description=(
        "Read-only ConsentOps helper: scan synthetic demo warehouse and "
        "propose classified cleanup. Execution requires the web UI."
    ),
    instruction=_instruction,
    tools=[FunctionTool(consentOpsScanAndPlan)],
)
