import type { FivetranAdapter } from "@/lib/connectors/fivetranAdapter";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { getRealFivetranConfigFromEnv } from "@/lib/connectors/realFivetranAdapter";

export type FivetranPanelMode = "mock" | "real_configured_stub";

/**
 * Fail-closed: demo workflow always uses MockFivetranAdapter until read-only REST status is implemented.
 * Real credentials only change the panel mode label — never auto-switch to stubbed write-capable adapter.
 */
export const getFivetranPanelMode = (): FivetranPanelMode =>
  getRealFivetranConfigFromEnv() ? "real_configured_stub" : "mock";

export const getFivetranModeLabel = (mode: FivetranPanelMode): string => {
  if (mode === "mock") {
    return "Mock connector data (no Fivetran credentials)";
  }
  return "Mock connector data (credentials set; read-only REST status stubbed)";
};

export const getFivetranAdapter = (): FivetranAdapter => new MockFivetranAdapter();
