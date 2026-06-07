#!/usr/bin/env python3
"""Build, push, and deploy the ConsentOps Next.js app to Cloud Run.

Typical usage (from repo root):

  python scripts/deploy_cloud_run.py

Requires Docker, gcloud, and permission to push to Artifact Registry and update
the Cloud Run service. Config resolves from .env, then terraform outputs, then
defaults documented in .env.example.

Terraform manages env vars and IAM; this script only updates the container image
(main.tf ignores image drift so docker push + gcloud update is the normal path).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCKERFILE = ROOT / "Dockerfile"
DEFAULT_REGION = "us-central1"
DEFAULT_SERVICE = "consentops-agent"
DEFAULT_ARTIFACT_REPO = "consentops"
DEFAULT_IMAGE_TAG = "latest"


@dataclass(frozen=True)
class DeployConfig:
    project: str
    region: str
    service_name: str
    image_uri: str
    registry_host: str


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _terraform_output(name: str) -> str | None:
    try:
        result = subprocess.run(
            ["terraform", "-chdir=infra/terraform", "output", "-raw", name],
            capture_output=True,
            text=True,
            check=False,
            cwd=ROOT,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def _require_tool(name: str) -> None:
    if shutil.which(name) is None:
        print(f"ERROR: '{name}' not found on PATH.", file=sys.stderr)
        sys.exit(1)


def _run(
    args: list[str],
    *,
    dry_run: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str] | None:
    printable = " ".join(args)
    print(f"+ {printable}")
    if dry_run:
        return None
    result = subprocess.run(args, text=True, check=False)
    if check and result.returncode != 0:
        print(f"ERROR: command failed (exit {result.returncode}): {printable}", file=sys.stderr)
        sys.exit(result.returncode)
    return result


def _resolve_config(*, tag: str) -> DeployConfig:
    project = (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCP_PROJECT")
        or os.environ.get("CLOUD_RUN_PROJECT")
    )
    if not project:
        print(
            "ERROR: Set GOOGLE_CLOUD_PROJECT in .env (or run terraform apply in infra/terraform).",
            file=sys.stderr,
        )
        sys.exit(1)

    region = (
        os.environ.get("GOOGLE_CLOUD_LOCATION")
        or os.environ.get("GCP_REGION")
        or os.environ.get("CLOUD_RUN_REGION")
        or DEFAULT_REGION
    )
    service_name = (
        os.environ.get("CLOUD_RUN_SERVICE_NAME")
        or _terraform_output("cloud_run_service_name")
        or DEFAULT_SERVICE
    )
    artifact_repo = os.environ.get("CLOUD_RUN_ARTIFACT_REPO", DEFAULT_ARTIFACT_REPO)

    image_uri = os.environ.get("CLOUD_RUN_IMAGE") or _terraform_output("suggested_image_uri")
    if not image_uri:
        image_uri = f"{region}-docker.pkg.dev/{project}/{artifact_repo}/{service_name}:{tag}"
    elif tag != DEFAULT_IMAGE_TAG and image_uri.endswith(f":{DEFAULT_IMAGE_TAG}"):
        image_uri = image_uri[: -len(DEFAULT_IMAGE_TAG)] + tag

    registry_host = f"{region}-docker.pkg.dev"
    return DeployConfig(
        project=project,
        region=region,
        service_name=service_name,
        image_uri=image_uri,
        registry_host=registry_host,
    )


def _service_url(config: DeployConfig) -> str:
    url = os.environ.get("CONSENTOPS_API_BASE_URL") or _terraform_output("cloud_run_url")
    if url:
        return url.rstrip("/")

    result = subprocess.run(
        [
            "gcloud",
            "run",
            "services",
            "describe",
            config.service_name,
            f"--project={config.project}",
            f"--region={config.region}",
            "--format=value(status.url)",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip().rstrip("/")
    return ""


def _configure_docker_auth(config: DeployConfig, *, dry_run: bool) -> None:
    _run(
        ["gcloud", "auth", "configure-docker", config.registry_host, "--quiet"],
        dry_run=dry_run,
    )


def _docker_build(config: DeployConfig, *, dry_run: bool) -> None:
    if not DOCKERFILE.is_file():
        print(f"ERROR: Dockerfile not found: {DOCKERFILE}", file=sys.stderr)
        sys.exit(1)
    _run(
        [
            "docker",
            "build",
            "-t",
            config.image_uri,
            "-f",
            str(DOCKERFILE),
            str(ROOT),
        ],
        dry_run=dry_run,
    )


def _docker_push(config: DeployConfig, *, dry_run: bool) -> None:
    _run(["docker", "push", config.image_uri], dry_run=dry_run)


def _gcloud_deploy(config: DeployConfig, *, dry_run: bool) -> None:
    _run(
        [
            "gcloud",
            "run",
            "services",
            "update",
            config.service_name,
            f"--image={config.image_uri}",
            f"--region={config.region}",
            f"--project={config.project}",
        ],
        dry_run=dry_run,
    )


def _http_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict | None = None,
    timeout_s: int = 120,
) -> tuple[int, dict | str]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout_s) as response:
        body = response.read().decode("utf-8")
        try:
            return response.status, json.loads(body)
        except json.JSONDecodeError:
            return response.status, body


def _smoke_test(base_url: str, *, timeout_s: int = 180) -> bool:
    if not base_url:
        print("WARNING: Could not resolve Cloud Run URL — skipping smoke test.", file=sys.stderr)
        return True

    deadline = time.time() + timeout_s
    attempt = 0
    last_error: str | None = None

    print(f"\nSmoke test: polling {base_url} (timeout {timeout_s}s)...")

    while time.time() < deadline:
        attempt += 1
        try:
            status_code, status_body = _http_json(f"{base_url}/api/status", timeout_s=30)
            if status_code != 200:
                raise RuntimeError(f"/api/status returned HTTP {status_code}")

            _, fivetran_body = _http_json(
                f"{base_url}/api/agent/fivetran",
                method="POST",
                payload={"tool": "list_connections"},
                timeout_s=120,
            )
            if not isinstance(fivetran_body, dict):
                raise RuntimeError("/api/agent/fivetran returned non-JSON")
            if fivetran_body.get("capability") != "fivetran_read_only":
                raise RuntimeError("/api/agent/fivetran missing fivetran_read_only capability")

            source = fivetran_body.get("source", "unknown")
            print(f"  Smoke test PASSED (attempt {attempt}): /api/status OK, fivetran source={source}")
            if isinstance(status_body, dict):
                mode = status_body.get("adapters", {}).get("fivetranIntegrationSource")
                if mode:
                    print(f"  Platform status: fivetranIntegrationSource={mode}")
            return True
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            print(f"  attempt {attempt}: not ready yet ({last_error[:160]})")
            time.sleep(10)

    print(f"SMOKE TEST FAILED after {timeout_s}s: {last_error}", file=sys.stderr)
    return False


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build, push, and deploy ConsentOps to Cloud Run.")
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip docker build (deploy an image already pushed).",
    )
    parser.add_argument(
        "--skip-push",
        action="store_true",
        help="Build locally but do not push (implies no deploy unless image already exists remotely).",
    )
    parser.add_argument(
        "--skip-deploy",
        action="store_true",
        help="Build and push only; do not run gcloud run services update.",
    )
    parser.add_argument(
        "--skip-smoke",
        action="store_true",
        help="Skip post-deploy HTTP smoke test.",
    )
    parser.add_argument(
        "--tag",
        default=os.environ.get("CLOUD_RUN_IMAGE_TAG", DEFAULT_IMAGE_TAG),
        help=f"Image tag (default: {DEFAULT_IMAGE_TAG}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing them.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    skip_smoke = args.skip_smoke or os.environ.get("CLOUD_RUN_SKIP_SMOKE", "").lower() in (
        "1",
        "true",
        "yes",
    )

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            try:
                reconfigure(encoding="utf-8")
            except (ValueError, OSError):
                pass

    _load_dotenv(ROOT / ".env")
    _load_dotenv(ROOT / ".env.local")

    if not args.dry_run:
        _require_tool("docker")
        _require_tool("gcloud")

    config = _resolve_config(tag=args.tag)

    print("Cloud Run deploy configuration:")
    print(f"  project:  {config.project}")
    print(f"  region:   {config.region}")
    print(f"  service:  {config.service_name}")
    print(f"  image:    {config.image_uri}")
    print()

    _configure_docker_auth(config, dry_run=args.dry_run)

    if not args.skip_build:
        _docker_build(config, dry_run=args.dry_run)
    else:
        print("Skipping docker build (--skip-build).")

    if not args.skip_push:
        if args.skip_build:
            print("Pushing existing local image tag...")
        _docker_push(config, dry_run=args.dry_run)
    else:
        print("Skipping docker push (--skip-push).")

    if args.skip_deploy or args.skip_push:
        if args.skip_deploy:
            print("Skipping gcloud deploy (--skip-deploy).")
        elif args.skip_push:
            print("Skipping gcloud deploy because image was not pushed (--skip-push).")
    else:
        _gcloud_deploy(config, dry_run=args.dry_run)

    if args.dry_run:
        print("\nDry run complete — no changes made.")
        return 0

    service_url = _service_url(config)
    if service_url:
        print(f"\nService URL: {service_url}")

    smoke_ok = True
    if not skip_smoke and not args.skip_deploy and not args.skip_push:
        smoke_ok = _smoke_test(service_url)

    if not smoke_ok:
        print(
            "\nDeploy updated Cloud Run but the smoke test failed. "
            "Check logs: gcloud run services logs read "
            f"{config.service_name} --region={config.region} --project={config.project}",
            file=sys.stderr,
        )
        return 1

    print("\nCloud Run deploy complete.")
    if service_url:
        print(f"  Dashboard: {service_url}")
        print(f"  Fivetran API: {service_url}/api/agent/fivetran")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
