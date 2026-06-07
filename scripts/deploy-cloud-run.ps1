# Build, push, and deploy ConsentOps Next.js app to Cloud Run.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
python scripts/deploy_cloud_run.py @args
exit $LASTEXITCODE
