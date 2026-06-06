#!/usr/bin/env python3
"""Deploy consentops_assistant to Vertex AI Agent Engine (Windows-safe).

Fixes ADK 1.14 packaging on Windows: dependency tarballs must use relative
arcnames (agent_engine_app.py at tar root), not full Windows paths.
"""

from __future__ import annotations

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


def _terraform_staging_bucket() -> str | None:
    try:
        result = subprocess.run(
            ["terraform", "-chdir=infra/terraform", "output", "-raw", "adk_staging_bucket"],
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


def _build_env_vars(project: str, region: str) -> dict[str, str]:
    """Agent Engine runtime env — do not set reserved GOOGLE_CLOUD_* names.

    Agent Engine ALWAYS runs Gemini via Vertex AI: the ADK reasoning-engine
    template (vertexai/preview/reasoning_engines/templates/adk.py) hard-sets
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1" at runtime, so a deployment
    env of FALSE (to use the Gemini Developer API + API key) is silently
    overridden — the engine still calls Vertex publisher models. Therefore the
    model MUST be a valid Vertex publisher model.

    The Cloud Run app keeps gemini-3.5-flash on the Developer API, but that id is
    a 404 as a Vertex publisher model in us-central1, so the engine uses a Vertex
    GA model instead (default gemini-2.5-flash; override with ADK_GEMINI_MODEL to
    another Vertex-valid id). Vertex auth uses the runtime service account, so no
    API key/secret is needed here.
    """
    model = os.environ.get("ADK_GEMINI_MODEL", "gemini-2.5-flash")
    return {
        "GOOGLE_GENAI_USE_VERTEXAI": "TRUE",
        "GEMINI_MODEL": model,
    }


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
                    if "__pycache__" in file_path.parts:
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


def _deploy(
    *,
    project: str,
    region: str,
    staging_bucket: str,
    agent_engine_id: str | None,
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

    agent_config = {
        "display_name": DISPLAY_NAME,
        "description": "Read-only ConsentOps scan+plan agent (execution in web UI).",
        "extra_packages": [str(package_dir.resolve())],
        "requirements": str((package_dir / APP_NAME / "requirements.txt").resolve()),
        "env_vars": _build_env_vars(project, region),
        "agent_engine": agent_engine,
    }

    print("Deploying to agent engine...")
    if agent_engine_id:
        resource_name = (
            f"projects/{project}/locations/{region}/reasoningEngines/{agent_engine_id}"
        )
        result = agent_engines.update(resource_name=resource_name, **agent_config)
    else:
        result = agent_engines.create(**agent_config)

    resource_name = getattr(result, "resource_name", None) or str(result)
    match = re.search(r"reasoningEngines/(\d+)", resource_name)
    return match.group(1) if match else None


def main() -> int:
    # Windows consoles default to cp1252 and crash on the non-ASCII status
    # output below (e.g. "→", "—"). Force UTF-8 so a successful deploy does not
    # exit non-zero on a cosmetic print.
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
        if agent_engine_id:
            print(f"Updating existing Agent Engine: {agent_engine_id}")

    print(f"Deploying {AGENT_DIR.relative_to(ROOT)} to Agent Engine...")
    print(f"  project:  {project}")
    print(f"  region:   {region}")
    print(f"  staging:  {staging_bucket}")
    print()

    restore_clone = _patch_module_agent_clone()
    restore_upload = _patch_upload_extra_packages()
    try:
        engine_id = _deploy(
            project=project,
            region=region,
            staging_bucket=staging_bucket,
            agent_engine_id=agent_engine_id,
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

    print(f'\nDone. Open Vertex AI → Agent Engine and chat with "{DISPLAY_NAME}".')
    return 0


if __name__ == "__main__":
    sys.exit(main())
