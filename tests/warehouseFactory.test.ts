import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";
import { getFivetranAdapter, getFivetranPanelMode } from "@/lib/connectors/fivetranAdapterFactory";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { RealFivetranAdapter } from "@/lib/connectors/realFivetranAdapter";
import { scanSubjectForWorkflow } from "@/lib/warehouse/warehouseFactory";
import { BigQueryWarehouseAdapter } from "@/lib/warehouse/bigQueryWarehouse";

describe("fivetran adapter factory", () => {
  const saved = {
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
  };

  beforeEach(() => {
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("uses mock adapter without credentials", () => {
    expect(getFivetranPanelMode()).toBe("mock");
    expect(getFivetranAdapter()).toBeInstanceOf(MockFivetranAdapter);
  });

  it("uses live read-only adapter when credentials exist", () => {
    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";
    expect(getFivetranPanelMode()).toBe("live_read_only");
    expect(getFivetranAdapter()).toBeInstanceOf(RealFivetranAdapter);
  });
});

describe("warehouse factory scan routing", () => {
  const saved = {
    CONSENTOPS_WAREHOUSE_MODE: process.env.CONSENTOPS_WAREHOUSE_MODE,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    BIGQUERY_DATASET: process.env.BIGQUERY_DATASET,
    CONSENTOPS_DEMO_MODE: process.env.CONSENTOPS_DEMO_MODE,
  };

  beforeEach(() => {
    resetDemoWorkflowStateForTests();
    process.env.CONSENTOPS_DEMO_MODE = "true";
    delete process.env.CONSENTOPS_WAREHOUSE_MODE;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.BIGQUERY_DATASET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("scans local JSON by default", async () => {
    const result = await scanSubjectForWorkflow(demoSubject, demoWarehouseTables);
    expect(result.scanSource).toBe("local_json");
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("routes scan to BigQuery when mode is bigquery_scan", async () => {
    process.env.CONSENTOPS_WAREHOUSE_MODE = "bigquery_scan";
    process.env.GOOGLE_CLOUD_PROJECT = "demo-project";
    process.env.BIGQUERY_DATASET = "consentops_demo";

    vi.spyOn(BigQueryWarehouseAdapter, "fromEnv").mockReturnValue({
      scanSubject: vi.fn().mockResolvedValue([
        {
          table: "crm_customers",
          recordId: "crm_customers_001",
          matchedFields: ["email"],
          confidence: "high",
          suggestedSensitivity: "direct_identifier",
        },
      ]),
    } as unknown as BigQueryWarehouseAdapter);

    const result = await scanSubjectForWorkflow(demoSubject, demoWarehouseTables);
    expect(result.scanSource).toBe("bigquery");
    expect(result.matches).toHaveLength(1);
  });
});
