/** Public judge/demo links (no secrets). Override via NEXT_PUBLIC_* in .env.local. */

const DEFAULT_GCP_PROJECT = "rapid-agent-hackathon-26";
const DEFAULT_GCP_REGION = "us-central1";
const DEFAULT_AGENT_ENGINE_ID = "7543255047694450688";

const AGENT_PLATFORM_BASE =
  "https://console.cloud.google.com/agent-platform/runtimes/locations";

/** Agent Platform Agent Engine playground. */
export function buildAgentEnginePlaygroundUrl(
  project = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT ?? DEFAULT_GCP_PROJECT,
  region = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_LOCATION ?? DEFAULT_GCP_REGION,
  engineId = process.env.NEXT_PUBLIC_AGENT_ENGINE_ID ?? DEFAULT_AGENT_ENGINE_ID,
): string {
  const override = process.env.NEXT_PUBLIC_AGENT_ENGINE_PLAYGROUND_URL?.trim();
  if (override) return override;

  return (
    `${AGENT_PLATFORM_BASE}/${region}/agent-engines/${engineId}/playground?project=${project}`
  );
}

export const AGENT_ENGINE_PLAYGROUND_URL = buildAgentEnginePlaygroundUrl();

export const GITHUB_REPO_URL = "https://github.com/prabhakaran-jm/ConsentOps-Agent";
