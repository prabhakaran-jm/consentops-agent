# Deploy consentops_assistant to Vertex AI Agent Engine.
# Uses scripts/deploy_adk_agent_engine.py (Windows-safe ADK template patch).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
python scripts/deploy_adk_agent_engine.py @args
exit $LASTEXITCODE
