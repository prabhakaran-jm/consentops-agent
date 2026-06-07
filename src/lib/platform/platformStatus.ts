import { getGeminiConfigFromEnv } from "@/lib/agent/geminiClient";
import type { PlannerSource } from "@/lib/agent/consentPlanner";
import {
  getFivetranActiveMode,
  getFivetranIntegrationSource,
  getFivetranPanelMode,
  type FivetranIntegrationSource,
  type FivetranPanelMode,
} from "@/lib/connectors/fivetranAdapterFactory";
import { READ_ONLY_FIVETRAN_TOOL_NAMES } from "@/lib/connectors/fivetranMcpRuntime";
import { getRealFivetranConfigFromEnv } from "@/lib/connectors/realFivetranAdapter";
import { getDemoWorkflowState } from "@/lib/demo/demoWorkflowState";
import { getBigQueryConfigFromEnv } from "@/lib/warehouse/bigQueryWarehouse";
import { getWarehouseModeFromEnv, type WarehouseMode } from "@/lib/warehouse/warehouseConfig";

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
    warehouse: WarehouseMode;
    warehouseScanSource: "local_json" | "bigquery";
    warehouseExecution: "local_json" | "bigquery";
    bigQueryConfigured: boolean;
    bigQueryProjectId: string | null;
    bigQueryDataset: string | null;
    fivetranActive: "mock" | "live_read_only" | "mcp_runtime";
    fivetranPanelMode: FivetranPanelMode;
    fivetranIntegrationSource: FivetranIntegrationSource;
    fivetranMcpRuntimeEnabled: boolean;
    fivetranMcpToolsAvailable: string[];
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
  const warehouseMode = getWarehouseModeFromEnv();
  const bigQueryConfig = getBigQueryConfigFromEnv();
  const bigQueryConfigured = bigQueryConfig !== null;

  let warehouseScanSource: "local_json" | "bigquery" = "local_json";
  if (warehouseMode !== "local_json" && bigQueryConfigured) {
    warehouseScanSource = "bigquery";
  }

  const warehouseExecution: "local_json" | "bigquery" =
    warehouseMode === "bigquery_full" && bigQueryConfigured ? "bigquery" : "local_json";

  return {
    syntheticDataOnly: true,
    disclaimer:
      "Hackathon demo on synthetic fixtures only. Not a compliance guarantee. No real personal data.",
    demoModeDocumented: {
      DEMO_MODE: envFlagEnabled("DEMO_MODE"),
      CONSENTOPS_DEMO_MODE: envFlagEnabled("CONSENTOPS_DEMO_MODE"),
      note: "Demo mode enforces synthetic subject allowlist on warehouse scan/execute.",
    },
    gemini: {
      configured: geminiConfig !== null,
      model: geminiConfig?.model ?? null,
    },
    adapters: {
      warehouse: warehouseMode,
      warehouseScanSource,
      warehouseExecution,
      bigQueryConfigured,
      bigQueryProjectId: bigQueryConfig?.projectId ?? null,
      bigQueryDataset: bigQueryConfig?.dataset ?? null,
      fivetranActive: getFivetranActiveMode(),
      fivetranPanelMode: getFivetranPanelMode(),
      fivetranIntegrationSource: getFivetranIntegrationSource(),
      fivetranMcpRuntimeEnabled: getFivetranIntegrationSource() === "mcp_runtime",
      fivetranMcpToolsAvailable: [...READ_ONLY_FIVETRAN_TOOL_NAMES].sort(),
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
