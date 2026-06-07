#!/usr/bin/env python3
"""Deploy consentops_assistant to Vertex AI Agent Engine (Windows-safe).

Fixes ADK 1.14 packaging on Windows: dependency tarballs must use relative
arcnames (agent_engine_app.py at tar root), not full Windows paths.

After agent.py or requirements.txt changes, recreate the engine — update()
does not rebuild the container. Use --recreate or ADK_RECREATE=true.
"""

from __future__ import annotations

import argparse
import io
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "consentops-adk" / "consentops_assistant"
STAGING_DIR = ROOT / ".adk-staging"
ID_FILE = ROOT / "consentops-adk" / ".agent_engine_id"
DISPLAY_NAME = os.environ.get("ADK_DISPLAY_NAME", "ConsentOps Assistant")
APP_NAME = AGENT_DIR.name
DEFAULT_CONSENTOPS_API = "https://consentops-agent-538209538110.us-central1.run.app"

_AGENT_ENGINE_APP = """\
from vertexai.preview.reasoning_engines import AdkApp
from consentops_assistant.agent import root_agent

adk_app = AdkApp(
    agent=root_agent,
    enable_tracing=True,
)
"""

_REGISTER_OPERATIONS = {
    "": ["get_session", "list_sessions", "create_session", "delete_session"],
    "async": [
        "async_get_session",
        "async_list_sessions",
        "async_create_session",
        "async_delete_session",
    ],
    "async_stream": ["async_stream_query"],
    "stream": ["stream_query", "streaming_agent_run_with_events"],
}


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


def _terraform_staging_bucket() -> str | None:
    return _terraform_output("adk_staging_bucket")


def _secret_ref(secret_id: str, version: str = "latest") -> Any:
    from google.cloud.aiplatform_v1.types import env_var

    return env_var.SecretRef(secret=secret_id, version=version)


def _build_env_vars(project: str, region: str) -> dict[str, Any]:
    """Agent Engine runtime env — do not set reserved GOOGLE_CLOUD_* names.

    Agent Engine ALWAYS runs Gemini via Vertex AI: the ADK reasoning-engine
    template hard-sets GOOGLE_GENAI_USE_VERTEXAI=1 at runtime. Use a Vertex-valid
    model id (default gemini-2.5-flash; override with ADK_GEMINI_MODEL).

    Fivetran MCP credentials are mounted from Secret Manager by default
    (FIVETRAN_API_KEY / FIVETRAN_API_SECRET). Set ADK_FIVETRAN_PLAIN_ENV=true
    to pass keys from .env as plain env (local experiments only).
    """
    model = os.environ.get("ADK_GEMINI_MODEL", "gemini-2.5-flash")
    consentops_api = os.environ.get("CONSENTOPS_API_BASE_URL", DEFAULT_CONSENTOPS_API).rstrip("/")

    # Fivetran MCP is OFF on Agent Engine by default — and this is a hard
    # limitation, not just a precaution. Installing the MCP server (fivetran-mcp)
    # into the agent venv pulls fastmcp>=2.0.0 + httpx>=0.28, which conflicts with
    # the google-adk/genai/aiplatform runtime and crashes the worker ("does not
    # have running instances"). Agent Engine has no `uvx` to isolate the server
    # the way local `adk web` does. The agent still surfaces Fivetran context from
    # Cloud Run's /api/agent/scan response. Local MCP is unaffected.
    # ADK_FIVETRAN_MCP_ENABLED=true is intentionally NOT recommended on Engine.
    mcp_enabled = os.environ.get("ADK_FIVETRAN_MCP_ENABLED", "false").lower() in ("1", "true", "yes")

    env: dict[str, Any] = {
        # Agent Engine injects GOOGLE_CLOUD_PROJECT as project number; aiplatform may
        # call Cloud Resource Manager to resolve it. GOOGLE_CLOUD_PROJECT is RESERVED
        # on Agent Engine (cannot be set), so we pass CLOUD_ML_PROJECT_ID instead.
        "CLOUD_ML_PROJECT_ID": project,
        "GOOGLE_GENAI_USE_VERTEXAI": "TRUE",
        "GEMINI_MODEL": model,
        "ADK_GEMINI_MODEL": model,
        "CONSENTOPS_API_BASE_URL": consentops_api,
        "ADK_FIVETRAN_MCP_ENABLED": "true" if mcp_enabled else "false",
    }

    if mcp_enabled:
        env["FIVETRAN_ALLOW_WRITES"] = "false"
        env["FIVETRAN_MCP_COMMAND"] = os.environ.get("ADK_FIVETRAN_MCP_COMMAND", "fivetran-mcp")
        use_secrets = os.environ.get("ADK_FIVETRAN_PLAIN_ENV", "").lower() not in ("1", "true", "yes")
        key_secret = os.environ.get("ADK_FIVETRAN_KEY_SECRET_ID", "FIVETRAN_API_KEY")
        secret_secret = os.environ.get("ADK_FIVETRAN_API_SECRET_ID", "FIVETRAN_API_SECRET")
        secret_version = os.environ.get("ADK_FIVETRAN_SECRET_VERSION", "latest")
        if use_secrets:
            env["FIVETRAN_API_KEY"] = _secret_ref(key_secret, secret_version)
            env["FIVETRAN_API_SECRET"] = _secret_ref(secret_secret, secret_version)
        else:
            api_key = os.environ.get("FIVETRAN_API_KEY", "").strip()
            api_secret = os.environ.get("FIVETRAN_API_SECRET", "").strip()
            if api_key and api_secret:
                env["FIVETRAN_API_KEY"] = api_key
                env["FIVETRAN_API_SECRET"] = api_secret

    return env


def _prepare_staging() -> Path:
    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)
    agent_dest = STAGING_DIR / APP_NAME
    shutil.copytree(
        AGENT_DIR,
        agent_dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    (STAGING_DIR / "agent_engine_app.py").write_text(_AGENT_ENGINE_APP, encoding="utf-8")
    return STAGING_DIR


def _patch_module_agent_clone() -> Any:
    """Preserve agent_framework through SDK clone() so console shows google-adk."""
    import vertexai.agent_engines._agent_engines as ae_mod

    original = ae_mod.ModuleAgent.clone

    def clone_with_framework(self: ae_mod.ModuleAgent) -> ae_mod.ModuleAgent:
        cloned = original(self)
        framework = getattr(self, "agent_framework", None)
        if framework:
            cloned.agent_framework = framework
        return cloned

    ae_mod.ModuleAgent.clone = clone_with_framework  # type: ignore[method-assign]
    return original


def _should_skip_staging_file(file_path: Path) -> bool:
    """Skip bytecode and AppleDouble/resource-fork junk that breaks Agent Engine builds."""
    if "__pycache__" in file_path.parts:
        return True
    name = file_path.name
    if name.startswith("._") or name == ".DS_Store" or name == "Thumbs.db":
        return True
    return False


def _warn_local_junk_packages() -> None:
    """Warn if local site-packages contain AppleDouble files (common after Mac archive sync)."""
    try:
        import google.adk  # noqa: PLC0415 - optional preflight only
    except ImportError:
        return

    adk_root = Path(google.adk.__file__).resolve().parent
    junk = [p for p in adk_root.rglob("*") if p.is_file() and p.name.startswith("._")]
    if not junk:
        return
    print(
        f"WARNING: Found {len(junk)} AppleDouble '._*' files under local google.adk.\n"
        "  These can pollute dependency scans. Reinstall before deploy:\n"
        "    pip uninstall google-adk -y && pip install google-adk==1.14.1",
        file=sys.stderr,
    )


def _patch_upload_extra_packages() -> Any:
    """Tar with relative arcnames so Agent Engine can import agent_engine_app."""
    import vertexai.agent_engines._agent_engines as ae_mod

    original = ae_mod._upload_extra_packages

    def clean_upload(*, extra_packages, gcs_bucket, gcs_dir_name, logger=ae_mod._LOGGER):
        logger.info("Creating in-memory tarfile of extra_packages (relative arcnames)")
        tar_fileobj = io.BytesIO()
        with tarfile.open(fileobj=tar_fileobj, mode="w|gz") as tar:
            for package_dir in extra_packages:
                root = Path(package_dir)
                for file_path in root.rglob("*"):
                    if not file_path.is_file():
                        continue
                    if _should_skip_staging_file(file_path):
                        continue
                    arcname = file_path.relative_to(root).as_posix()
                    tar.add(file_path, arcname=arcname)
        tar_fileobj.seek(0)
        blob = gcs_bucket.blob(f"{gcs_dir_name}/{ae_mod._EXTRA_PACKAGES_FILE}")
        blob.upload_from_string(tar_fileobj.read())
        logger.info(
            f"Writing to gs://{gcs_bucket.name}/{gcs_dir_name}/{ae_mod._EXTRA_PACKAGES_FILE}"
        )

    ae_mod._upload_extra_packages = clean_upload
    return original


def _engine_resource_name(project: str, region: str, engine_id: str) -> str:
    return f"projects/{project}/locations/{region}/reasoningEngines/{engine_id}"


def _delete_engine(*, project: str, region: str, engine_id: str) -> None:
    from vertexai import agent_engines

    resource_name = _engine_resource_name(project, region, engine_id)
    print(f"Deleting Agent Engine {engine_id} (recreate required after agent.py changes)...")
    agent_engines.delete(resource_name, force=True)
    print("Delete requested — waiting for delete to propagate...")
    import time

    wait_s = int(os.environ.get("ADK_DELETE_WAIT_SECONDS", "30"))
    time.sleep(wait_s)


def _deploy(
    *,
    project: str,
    region: str,
    staging_bucket: str,
    agent_engine_id: str | None,
    service_account: str | None,
) -> str | None:
    import vertexai
    from vertexai import agent_engines

    package_dir = _prepare_staging()
    sys.path.insert(0, str(package_dir))

    vertexai.init(project=project, location=region, staging_bucket=staging_bucket)

    agent_engine = agent_engines.ModuleAgent(
        module_name="agent_engine_app",
        agent_name="adk_app",
        register_operations=_REGISTER_OPERATIONS,
        sys_paths=["."],
        agent_framework="google-adk",
    )

    agent_config: dict[str, Any] = {
        "display_name": DISPLAY_NAME,
        "description": (
            "Read-only ConsentOps agent: Fivetran MCP pipeline discovery, "
            "warehouse scan, classified cleanup plan. Execution in web UI."
        ),
        "extra_packages": [str(package_dir.resolve())],
        "requirements": str((package_dir / APP_NAME / "requirements.txt").resolve()),
        "env_vars": _build_env_vars(project, region),
        "agent_engine": agent_engine,
        # Keep a warm instance so the Playground never hits a cold-start that
        # reports "does not have running instances".
        "min_instances": int(os.environ.get("ADK_MIN_INSTANCES", "1")),
        "max_instances": int(os.environ.get("ADK_MAX_INSTANCES", "2")),
    }
    if service_account:
        agent_config["service_account"] = service_account

    print("Deploying to agent engine...")
    create_attempts = int(os.environ.get("ADK_CREATE_RETRIES", "3"))
    last_exc: Exception | None = None

    for attempt in range(1, create_attempts + 1):
        try:
            if agent_engine_id:
                resource_name = _engine_resource_name(project, region, agent_engine_id)
                result = agent_engines.update(resource_name=resource_name, **agent_config)
            else:
                result = agent_engines.create(**agent_config)
            resource_name = getattr(result, "resource_name", None) or str(result)
            match = re.search(r"reasoningEngines/(\d+)", resource_name)
            return match.group(1) if match else None
        except Exception as exc:
            last_exc = exc
            from google.api_core import exceptions as gcp_exceptions

            retryable = isinstance(exc, gcp_exceptions.InternalServerError)
            if not retryable or attempt == create_attempts:
                raise
            backoff_s = 30 * attempt
            print(
                f"Create attempt {attempt} failed ({exc}). "
                f"Retrying in {backoff_s}s ({attempt + 1}/{create_attempts})...",
                file=sys.stderr,
            )
            import time

            time.sleep(backoff_s)

    if last_exc:
        raise last_exc
    return None


def _smoke_test(*, project: str, region: str, engine_id: str, timeout_s: int = 300) -> bool:
    """Poll create_session until the engine has a running instance (or time out).

    Mirrors `await engine.async_create_session(...)`; a 200 here means the
    Playground will not show "does not have running instances".
    """
    import time

    from vertexai import agent_engines

    resource_name = _engine_resource_name(project, region, engine_id)
    deadline = time.time() + timeout_s
    attempt = 0
    last_error: Exception | None = None

    print(f"\nSmoke test: polling create_session (timeout {timeout_s}s)...")
    while time.time() < deadline:
        attempt += 1
        try:
            engine = agent_engines.get(resource_name)
            session = engine.create_session(user_id="smoke")
            session_id = (
                session.get("id") if isinstance(session, dict) else getattr(session, "id", session)
            )
            print(f"  Smoke test PASSED (attempt {attempt}): session {session_id}")
            return True
        except Exception as exc:  # noqa: BLE001 - report and retry until timeout
            last_error = exc
            print(f"  attempt {attempt}: not ready yet ({str(exc)[:140]})")
            time.sleep(15)

    print(f"SMOKE TEST FAILED after {timeout_s}s: {last_error}", file=sys.stderr)
    return False


def _print_post_deploy_hints(*, project: str, region: str, engine_id: str | None) -> None:
    print()
    print("Post-deploy validation (Agent Engine Playground):")
    print("  1. New session → prompt: scan Ana Reyes, do not execute")
    print("  2. Trace should show consentOpsScanWarehouse + consentOpsBuildPlan")
    print("  3. Record count should match Cloud Run BigQuery (~25), not fixture 37")
    print("  4. Fivetran context comes from the scan response. MCP runs locally")
    print("     (adk web via uvx), not on Engine — installing fivetran-mcp here pulls")
    print("     fastmcp/httpx that crash the runtime, and Engine has no uvx to isolate it.")
    if engine_id:
        print(f"  Engine id: {engine_id}")
    runtime_sa = os.environ.get("ADK_SERVICE_ACCOUNT") or _terraform_output("runtime_service_account")
    if runtime_sa:
        print()
        print("If Fivetran MCP fails with permission denied on secrets, grant Secret Accessor:")
        print(f"  gcloud secrets add-iam-policy-binding FIVETRAN_API_KEY \\")
        print(f"    --member=serviceAccount:{runtime_sa} --role=roles/secretmanager.secretAccessor")
        print(f"  gcloud secrets add-iam-policy-binding FIVETRAN_API_SECRET \\")
        print(f"    --member=serviceAccount:{runtime_sa} --role=roles/secretmanager.secretAccessor")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy ConsentOps ADK agent to Vertex AI Agent Engine.")
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="Delete existing engine (from .agent_engine_id) and create a fresh one. "
        "Required after agent.py or requirements.txt changes.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    recreate = args.recreate or os.environ.get("ADK_RECREATE", "").lower() in ("1", "true", "yes")

    for _stream in (sys.stdout, sys.stderr):
        _reconfigure = getattr(_stream, "reconfigure", None)
        if _reconfigure:
            try:
                _reconfigure(encoding="utf-8")
            except (ValueError, OSError):
                pass

    _load_dotenv(ROOT / ".env")

    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
    region = os.environ.get("GOOGLE_CLOUD_LOCATION") or os.environ.get("GCP_REGION") or "us-central1"
    staging_bucket = os.environ.get("ADK_STAGING_BUCKET") or _terraform_staging_bucket()
    service_account = os.environ.get("ADK_SERVICE_ACCOUNT") or _terraform_output("runtime_service_account")

    if not project:
        print("ERROR: Set GOOGLE_CLOUD_PROJECT in .env", file=sys.stderr)
        return 1
    if not staging_bucket:
        print(
            "ERROR: Set ADK_STAGING_BUCKET or run: cd infra/terraform && terraform apply",
            file=sys.stderr,
        )
        return 1
    if not AGENT_DIR.is_dir():
        print(f"ERROR: Agent folder not found: {AGENT_DIR}", file=sys.stderr)
        return 1

    agent_engine_id: str | None = None
    if ID_FILE.is_file():
        agent_engine_id = ID_FILE.read_text(encoding="utf-8").strip() or None

    if recreate and agent_engine_id:
        import vertexai

        vertexai.init(project=project, location=region, staging_bucket=staging_bucket)
        try:
            _delete_engine(project=project, region=region, engine_id=agent_engine_id)
        except Exception as exc:
            print(f"WARNING: Delete failed ({exc}) — will attempt create anyway.", file=sys.stderr)
        ID_FILE.unlink(missing_ok=True)
        agent_engine_id = None
    elif agent_engine_id:
        print(f"Updating existing Agent Engine: {agent_engine_id}")
        print(
            "NOTE: update() does not rebuild the container after agent.py/requirements changes.",
            file=sys.stderr,
        )
        print("  Re-run with --recreate or ADK_RECREATE=true after code changes.", file=sys.stderr)

    print(f"Deploying {AGENT_DIR.relative_to(ROOT)} to Agent Engine...")
    print(f"  project:  {project}")
    print(f"  region:   {region}")
    print(f"  staging:  {staging_bucket}")
    if service_account:
        print(f"  runtime SA: {service_account}")
    print(f"  recreate: {recreate}")
    print()

    _warn_local_junk_packages()

    restore_clone = _patch_module_agent_clone()
    restore_upload = _patch_upload_extra_packages()
    try:
        engine_id = _deploy(
            project=project,
            region=region,
            staging_bucket=staging_bucket,
            agent_engine_id=agent_engine_id,
            service_account=service_account,
        )
    except Exception as exc:
        import traceback
        from google.api_core import exceptions as gcp_exceptions

        if agent_engine_id and isinstance(exc, gcp_exceptions.NotFound):
            print(
                f"Agent Engine {agent_engine_id} not found — creating a new one...",
                file=sys.stderr,
            )
            ID_FILE.unlink(missing_ok=True)
            try:
                engine_id = _deploy(
                    project=project,
                    region=region,
                    staging_bucket=staging_bucket,
                    agent_engine_id=None,
                    service_account=service_account,
                )
            except Exception as retry_exc:
                print(f"Deploy failed: {retry_exc}", file=sys.stderr)
                traceback.print_exc()
                return 1
        else:
            print(f"Deploy failed: {exc}", file=sys.stderr)
            traceback.print_exc()
            match = re.search(r"reasoningEngines/(\d+)", str(exc))
            if match and not ID_FILE.is_file():
                print(
                    f"\nPartial resource id: {match.group(1)} — save to {ID_FILE.relative_to(ROOT)} "
                    "and rerun to update, or delete in Console first.",
                    file=sys.stderr,
                )
            return 1
    finally:
        import vertexai.agent_engines._agent_engines as ae_mod

        ae_mod.ModuleAgent.clone = restore_clone  # type: ignore[method-assign]
        ae_mod._upload_extra_packages = restore_upload
        shutil.rmtree(STAGING_DIR, ignore_errors=True)

    if engine_id:
        ID_FILE.write_text(engine_id, encoding="utf-8")
        print(f"Saved agent_engine_id to {ID_FILE.relative_to(ROOT)}")
        console_url = (
            "https://console.cloud.google.com/vertex-ai/agents/agent-engines/"
            f"{engine_id}?project={project}"
        )
        print(f"Engine id: {engine_id}")
        print(f"Vertex AI Agent Engine console: {console_url}")

    smoke_ok = True
    if engine_id and os.environ.get("ADK_SKIP_SMOKE", "").lower() not in ("1", "true", "yes"):
        smoke_ok = _smoke_test(project=project, region=region, engine_id=engine_id)

    print(f'\nDone. Open Vertex AI → Agent Engine and chat with "{DISPLAY_NAME}".')
    _print_post_deploy_hints(project=project, region=region, engine_id=engine_id)

    if not smoke_ok:
        print(
            "\nDeploy created the engine but the smoke test failed (no running instance). "
            "Check logs: gcloud logging read "
            f"'resource.labels.reasoning_engine_id={engine_id}' "
            f"--project={project} --limit=50 --order=desc",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
