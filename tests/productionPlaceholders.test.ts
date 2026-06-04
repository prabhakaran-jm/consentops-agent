import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ReadOnlyFivetranError,
  RealFivetranAdapter,
} from "@/lib/connectors/realFivetranAdapter";
import { BigQueryWarehouseAdapter } from "@/lib/warehouse/bigQueryWarehouse";
import { demoSubject } from "@/lib/demo/seedData";
import type { CleanupPlan } from "@/lib/warehouse/types";
import type { BigQueryQueryRunner } from "@/lib/warehouse/bigQueryClient";

const PLANTED_FIVETRAN_SECRET = "plant-fake-fivetran-secret-abc123";
const PLANTED_BQ_PROJECT = "plant-fake-gcp-project-xyz789";

const minimalPlan: CleanupPlan = {
  id: "plan_placeholder_test",
  subjectId: demoSubject.id,
  createdAtIso: "2026-06-02T10:00:00.000Z",
  totalMatchesBeforeCleanup: 0,
  actions: [],
};

describe("production adapters", () => {
  const savedEnv = {
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
    BIGQUERY_DATASET: process.env.BIGQUERY_DATASET,
    CONSENTOPS_DEMO_MODE: process.env.CONSENTOPS_DEMO_MODE,
  };

  beforeEach(() => {
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.BIGQUERY_PROJECT_ID;
    delete process.env.BIGQUERY_DATASET;
    process.env.CONSENTOPS_DEMO_MODE = "true";
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

  it("RealFivetranAdapter triggerSync is read-only and omits planted secrets", async () => {
    const adapter = new RealFivetranAdapter({
      apiKey: "plant-fake-fivetran-key",
      apiSecret: PLANTED_FIVETRAN_SECRET,
    });

    let thrown: unknown;
    try {
      await adapter.triggerSync("conn_1");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ReadOnlyFivetranError);
    const message = (thrown as Error).message;
    expect(message).toMatch(/read-only/i);
    expect(message).not.toContain(PLANTED_FIVETRAN_SECRET);
  });

  it("BigQueryWarehouseAdapter.fromEnv returns null when config is missing", () => {
    expect(BigQueryWarehouseAdapter.fromEnv()).toBeNull();
  });

  it("BigQueryWarehouseAdapter scan errors omit planted project ids", async () => {
    const runner: BigQueryQueryRunner = {
      async query() {
        throw new Error(`Access denied to ${PLANTED_BQ_PROJECT}`);
      },
    };

    const adapter = new BigQueryWarehouseAdapter(
      { projectId: PLANTED_BQ_PROJECT, dataset: "plant-fake-dataset-secret" },
      runner,
    );

    await expect(adapter.scanSubject(demoSubject)).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return !message.includes("plant-fake-dataset-secret");
    });
  });

  it("BigQuery executeApprovedCleanup validates approval without leaking config", async () => {
    const runner: BigQueryQueryRunner = {
      async query() {
        return { rows: [] };
      },
    };

    const adapter = new BigQueryWarehouseAdapter(
      { projectId: PLANTED_BQ_PROJECT, dataset: "consentops_demo" },
      runner,
    );

    await expect(
      adapter.executeApprovedCleanup({
        plan: minimalPlan,
        approval: {
          approvalId: "approval_test",
          approvedActionIds: ["missing"],
          approvedBy: "demo-reviewer",
          approvedAt: "2026-06-02T10:00:00.000Z",
        },
        approvedActionIds: ["missing"],
        matches: [],
        knownRecordIds: new Set(),
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return !message.includes(PLANTED_BQ_PROJECT);
    });
  });
});
