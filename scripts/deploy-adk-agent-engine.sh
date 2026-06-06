#!/usr/bin/env bash
# Deploy consentops_assistant to Vertex AI Agent Engine.
# Uses scripts/deploy_adk_agent_engine.py (Windows-safe ADK template patch).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

exec python scripts/deploy_adk_agent_engine.py "$@"
