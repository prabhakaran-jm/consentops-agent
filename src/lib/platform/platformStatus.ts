import { getGeminiConfigFromEnv } from "@/lib/agent/geminiClient";
import type { PlannerSource } from "@/lib/agent/consentPlanner";
import { getFivetranPanelMode, type FivetranPanelMode } from "@/lib/connectors/fivetranAdapterFactory";
import { getRealFivetranConfigFromEnv } from "@/lib/connectors/realFivetranAdapter";
import { getDemoWorkflowState } from "@/lib/demo/demoWorkflowState";
import { getBigQueryConfigFromEnv } from "@/lib/warehouse/bigQueryWarehouse";

import packageJson from "../../../package.json";

const envFlagEnabled = (name: string): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
};

export type PlatformStatus = {
  syntheticDataOnly: true;
  disclaimer: string;
  demoModeDocumented: {
    DEMO_MODE: boolean;
    CONSENTOPS_DEMO_MODE: boolean;
    note: string;
  };
  gemini: {
    configured: boolean;
    model: string | null;
  };
  adapters: {
    warehouse: "local_json";
    bigQueryConfigured: boolean;
    fivetranActive: "mock";
    fivetranPanelMode: FivetranPanelMode;
    fivetranRealConfigured: boolean;
  };
  workflow: {
    hasLatestPlan: boolean;
    lastPlanSource: PlannerSource | null;
    lastPlanWarning: string | null;
    hasLatestAudit: boolean;
  };
  build: {
    version: string;
  };
  generatedAtIso: string;
};

export const getPlatformStatus = (): PlatformStatus => {
  const geminiConfig = getGeminiConfigFromEnv();
  const workflow = getDemoWorkflowState();

  return {
    syntheticDataOnly: true,
    disclaimer:
      "Hackathon demo on synthetic fixtures only. Not a compliance guarantee. No real personal data.",
    demoModeDocumented: {
      DEMO_MODE: envFlagEnabled("DEMO_MODE"),
      CONSENTOPS_DEMO_MODE: envFlagEnabled("CONSENTOPS_DEMO_MODE"),
      note: "Documented demo flags only; adapter switching is not wired from env yet.",
    },
    gemini: {
      configured: geminiConfig !== null,
      model: geminiConfig?.model ?? null,
    },
    adapters: {
      warehouse: "local_json",
      bigQueryConfigured: getBigQueryConfigFromEnv() !== null,
      fivetranActive: "mock",
      fivetranPanelMode: getFivetranPanelMode(),
      fivetranRealConfigured: getRealFivetranConfigFromEnv() !== null,
    },
    workflow: {
      hasLatestPlan: workflow.latestPlan !== null,
      lastPlanSource: workflow.latestPlannerSource,
      lastPlanWarning: workflow.latestPlannerWarning,
      hasLatestAudit: workflow.latestAudit !== null,
    },
    build: {
      version: packageJson.version,
    },
    generatedAtIso: new Date().toISOString(),
  };
};
