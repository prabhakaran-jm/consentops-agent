#!/usr/bin/env bash
# Build, push, and deploy ConsentOps Next.js app to Cloud Run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

exec python scripts/deploy_cloud_run.py "$@"
