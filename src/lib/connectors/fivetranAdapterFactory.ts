import type { FivetranAdapter } from "@/lib/connectors/fivetranAdapter";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import {
  getRealFivetranConfigFromEnv,
  RealFivetranAdapter,
} from "@/lib/connectors/realFivetranAdapter";

export type FivetranPanelMode = "mock" | "live_read_only";

export const getFivetranPanelMode = (): FivetranPanelMode =>
  getRealFivetranConfigFromEnv() ? "live_read_only" : "mock";

export const getFivetranModeLabel = (mode: FivetranPanelMode): string => {
  if (mode === "mock") {
    return "Mock connector data (no Fivetran credentials)";
  }
  return "Live Fivetran REST (read-only status)";
};

export const getFivetranAdapter = (): FivetranAdapter => {
  const live = RealFivetranAdapter.fromEnv();
  if (live) return live;
  return new MockFivetranAdapter();
};

export const getFivetranActiveMode = (): "mock" | "live_read_only" =>
  getRealFivetranConfigFromEnv() ? "live_read_only" : "mock";
