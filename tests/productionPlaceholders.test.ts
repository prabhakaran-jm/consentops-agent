import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RealFivetranAdapter } from "@/lib/connectors/realFivetranAdapter";
import { BigQueryWarehouseAdapter } from "@/lib/warehouse/bigQueryWarehouse";
import { demoSubject } from "@/lib/demo/seedData";
import type { CleanupPlan } from "@/lib/warehouse/types";

const PLANTED_FIVETRAN_SECRET = "plant-fake-fivetran-secret-abc123";
const PLANTED_BQ_PROJECT = "plant-fake-gcp-project-xyz789";

const minimalPlan: CleanupPlan = {
  id: "plan_placeholder_test",
  subjectId: demoSubject.id,
  createdAtIso: "2026-06-02T10:00:00.000Z",
  totalMatchesBeforeCleanup: 0,
  actions: [],
};

describe("production adapter placeholders", () => {
  const savedEnv = {
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
    BIGQUERY_DATASET: process.env.BIGQUERY_DATASET,
  };

  beforeEach(() => {
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.BIGQUERY_PROJECT_ID;
    delete process.env.BIGQUERY_DATASET;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("RealFivetranAdapter.fromEnv returns null when credentials are missing", () => {
    expect(RealFivetranAdapter.fromEnv()).toBeNull();
  });

  it("RealFivetranAdapter methods reject with not implemented and omit planted secrets", async () => {
    const adapter = new RealFivetranAdapter({
      apiKey: "plant-fake-fivetran-key",
      apiSecret: PLANTED_FIVETRAN_SECRET,
    });

    let thrown: unknown;
    try {
      await adapter.listConnectors();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toMatch(/not implemented/i);
    expect(message).not.toContain(PLANTED_FIVETRAN_SECRET);
    expect(message).not.toContain("plant-fake-fivetran-key");
  });

  it("BigQueryWarehouseAdapter.fromEnv returns null when config is missing", () => {
    expect(BigQueryWarehouseAdapter.fromEnv()).toBeNull();
  });

  it("BigQueryWarehouseAdapter methods reject with not implemented and omit planted secrets", async () => {
    const adapter = new BigQueryWarehouseAdapter({
      projectId: PLANTED_BQ_PROJECT,
      dataset: "plant-fake-dataset-secret",
    });

    let thrown: unknown;
    try {
      await adapter.scanSubject(demoSubject);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toMatch(/not implemented/i);
    expect(message).not.toContain(PLANTED_BQ_PROJECT);
    expect(message).not.toContain("plant-fake-dataset-secret");
  });

  it("BigQuery executeApprovedCleanup placeholder rejects without leaking config", async () => {
    const adapter = new BigQueryWarehouseAdapter({
      projectId: PLANTED_BQ_PROJECT,
      dataset: "consentops_demo",
    });

    await expect(
      adapter.executeApprovedCleanup({
        plan: minimalPlan,
        approval: {
          approvalId: "approval_test",
          approvedActionIds: [],
          approvedBy: "demo-reviewer",
          approvedAt: "2026-06-02T10:00:00.000Z",
        },
        approvedActionIds: [],
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return message.match(/not implemented/i) !== null && !message.includes(PLANTED_BQ_PROJECT);
    });
  });
});
