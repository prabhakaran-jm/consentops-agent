import type { FivetranAdapter } from "@/lib/connectors/fivetranAdapter";
import { McpFivetranAdapter } from "@/lib/connectors/mcpFivetranAdapter";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { isFivetranMcpRuntimeEnabled } from "@/lib/connectors/fivetranMcpRuntime";
import {
  getRealFivetranConfigFromEnv,
  RealFivetranAdapter,
} from "@/lib/connectors/realFivetranAdapter";

export type FivetranPanelMode = "mock" | "live_read_only" | "mcp_runtime";

export type FivetranIntegrationSource = "mock" | "rest" | "mcp_runtime";

export const getFivetranIntegrationSource = (): FivetranIntegrationSource => {
  if (isFivetranMcpRuntimeEnabled() && McpFivetranAdapter.fromEnv()) {
    return "mcp_runtime";
  }
  if (getRealFivetranConfigFromEnv()) return "rest";
  return "mock";
};

export const getFivetranPanelMode = (): FivetranPanelMode => {
  const source = getFivetranIntegrationSource();
  if (source === "mcp_runtime") return "mcp_runtime";
  if (source === "rest") return "live_read_only";
  return "mock";
};

export const getFivetranModeLabel = (mode: FivetranPanelMode): string => {
  if (mode === "mock") {
    return "Mock connector data (no Fivetran credentials)";
  }
  if (mode === "mcp_runtime") {
    return "Fivetran MCP runtime (read-only; REST fallback on failure)";
  }
  return "Live Fivetran REST (read-only status mirror)";
};

export const getFivetranAdapter = (): FivetranAdapter => {
  const mcp = McpFivetranAdapter.fromEnv();
  if (mcp) return mcp;

  const live = RealFivetranAdapter.fromEnv();
  if (live) return live;

  return new MockFivetranAdapter();
};

export const getFivetranActiveMode = (): "mock" | "live_read_only" | "mcp_runtime" =>
  getFivetranPanelMode();
