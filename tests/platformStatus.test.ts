import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildDemoPlan } from "@/lib/demo/demoWorkflowService";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";
import { getPlatformStatus } from "@/lib/platform/platformStatus";

const PLANTED_SECRET = "plant-fake-gemini-key-status-test";

describe("platform status", () => {
  const savedEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
    FIVETRAN_MCP_RUNTIME: process.env.FIVETRAN_MCP_RUNTIME,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    BIGQUERY_DATASET: process.env.BIGQUERY_DATASET,
    CONSENTOPS_WAREHOUSE_MODE: process.env.CONSENTOPS_WAREHOUSE_MODE,
    DEMO_MODE: process.env.DEMO_MODE,
    CONSENTOPS_DEMO_MODE: process.env.CONSENTOPS_DEMO_MODE,
  };

  beforeEach(() => {
    resetDemoWorkflowStateForTests();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
    delete process.env.FIVETRAN_MCP_RUNTIME;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.BIGQUERY_DATASET;
    delete process.env.CONSENTOPS_WAREHOUSE_MODE;
    delete process.env.DEMO_MODE;
    delete process.env.CONSENTOPS_DEMO_MODE;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reports synthetic-only demo defaults without secrets", () => {
    const status = getPlatformStatus();
    const serialized = JSON.stringify(status);

    expect(status.syntheticDataOnly).toBe(true);
    expect(status.gemini.configured).toBe(false);
    expect(status.adapters.fivetranActive).toBe("mock");
    expect(status.adapters.fivetranPanelMode).toBe("mock");
    expect(status.adapters.warehouse).toBe("local_json");
    expect(status.adapters.warehouseScanSource).toBe("local_json");
    expect(status.adapters.warehouseExecution).toBe("local_json");
    expect(status.workflow.lastPlanSource).toBeNull();
    expect(serialized).not.toContain(PLANTED_SECRET);
  });

  it("reports configured flags without exposing secret values", () => {
    process.env.GEMINI_API_KEY = PLANTED_SECRET;
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.FIVETRAN_API_KEY = "plant-fivetran-key";
    process.env.FIVETRAN_API_SECRET = "plant-fivetran-secret";
    process.env.GOOGLE_CLOUD_PROJECT = "plant-gcp-project";
    process.env.BIGQUERY_DATASET = "consentops_demo";
    process.env.DEMO_MODE = "true";

    const status = getPlatformStatus();
    const serialized = JSON.stringify(status);

    expect(status.gemini.configured).toBe(true);
    expect(status.gemini.model).toBe("gemini-3.5-flash");
    expect(status.adapters.fivetranRealConfigured).toBe(true);
    expect(status.adapters.bigQueryConfigured).toBe(true);
    expect(status.adapters.bigQueryProjectId).toBe("plant-gcp-project");
    expect(status.adapters.bigQueryDataset).toBe("consentops_demo");
    expect(status.demoModeDocumented.DEMO_MODE).toBe(true);
    expect(serialized).not.toContain(PLANTED_SECRET);
    expect(serialized).not.toContain("plant-fivetran-secret");
    expect(status.adapters.bigQueryProjectId).toBe("plant-gcp-project");
  });

  it("reports bigquery execution when mode is bigquery_full", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "plant-gcp-project";
    process.env.BIGQUERY_DATASET = "consentops_demo";
    process.env.CONSENTOPS_WAREHOUSE_MODE = "bigquery_full";

    const status = getPlatformStatus();

    expect(status.adapters.warehouse).toBe("bigquery_full");
    expect(status.adapters.warehouseScanSource).toBe("bigquery");
    expect(status.adapters.warehouseExecution).toBe("bigquery");
  });

  it("reports mcp_runtime when FIVETRAN_MCP_RUNTIME and credentials are set", () => {
    process.env.FIVETRAN_MCP_RUNTIME = "true";
    process.env.FIVETRAN_API_KEY = "plant-fivetran-key";
    process.env.FIVETRAN_API_SECRET = "plant-fivetran-secret";

    const status = getPlatformStatus();

    expect(status.adapters.fivetranIntegrationSource).toBe("mcp_runtime");
    expect(status.adapters.fivetranPanelMode).toBe("mcp_runtime");
    expect(status.adapters.fivetranMcpRuntimeEnabled).toBe(true);
  });

  it("reflects last planner source after buildDemoPlan", async () => {
    await buildDemoPlan();
    const status = getPlatformStatus();

    expect(status.workflow.hasLatestPlan).toBe(true);
    expect(status.workflow.lastPlanSource).toBe("deterministic");
  });
});
