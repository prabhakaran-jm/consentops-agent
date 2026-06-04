import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { demoSubject } from "@/lib/demo/seedData";
import { buildSubjectScanSql } from "@/lib/warehouse/bigQueryClient";
import { BigQueryWarehouseAdapter } from "@/lib/warehouse/bigQueryWarehouse";
import type { BigQueryQueryRunner } from "@/lib/warehouse/bigQueryClient";
import type { CleanupPlan } from "@/lib/warehouse/types";

const PLANTED_PROJECT = "plant-bq-project-secret";

describe("BigQueryWarehouseAdapter", () => {
  const savedDemoMode = process.env.CONSENTOPS_DEMO_MODE;

  beforeEach(() => {
    process.env.CONSENTOPS_DEMO_MODE = "true";
  });

  afterEach(() => {
    if (savedDemoMode === undefined) delete process.env.CONSENTOPS_DEMO_MODE;
    else process.env.CONSENTOPS_DEMO_MODE = savedDemoMode;
  });

  it("builds parameterized scan SQL without raw PII interpolation", () => {
    const { sql, params } = buildSubjectScanSql(
      { projectId: PLANTED_PROJECT, dataset: "consentops_demo" },
      "crm_customers",
      demoSubject,
    );

    expect(sql).toContain("@subjectEmail");
    expect(sql).not.toContain(demoSubject.email);
    expect(params.subjectEmail).toBe(demoSubject.email.toLowerCase());
  });

  it("scanSubject maps BigQuery rows to DataMatch objects", async () => {
    const runner: BigQueryQueryRunner = {
      async query() {
        return {
          rows: [
            {
              id: "crm_customers_001",
              email: demoSubject.email,
              customerId: demoSubject.customerId,
            },
          ],
        };
      },
    };

    const adapter = new BigQueryWarehouseAdapter(
      { projectId: PLANTED_PROJECT, dataset: "consentops_demo" },
      runner,
    );

    const matches = await adapter.scanSubject(demoSubject);
    expect(matches.some((match) => match.recordId === "crm_customers_001")).toBe(true);
  });

  it("executeApprovedCleanup runs record-scoped DML via runner", async () => {
    const executed: string[] = [];
    const runner: BigQueryQueryRunner = {
      async query({ sql }) {
        executed.push(sql);
        return { rows: [] };
      },
    };

    const adapter = new BigQueryWarehouseAdapter(
      { projectId: PLANTED_PROJECT, dataset: "consentops_demo" },
      runner,
    );

    const plan: CleanupPlan = {
      id: "plan_bq_test",
      subjectId: demoSubject.id,
      createdAtIso: "2026-06-03T00:00:00.000Z",
      totalMatchesBeforeCleanup: 1,
      actions: [
        {
          id: "act_bq_1",
          table: "crm_customers",
          recordIds: ["crm_customers_001"],
          classification: "delete",
          fields: ["email"],
        },
      ],
    };

    const result = await adapter.executeApprovedCleanup({
      plan,
      approval: {
        approvalId: "appr_1",
        approvedActionIds: ["act_bq_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-03T00:00:00.000Z",
      },
      approvedActionIds: ["act_bq_1"],
      matches: [
        {
          table: "crm_customers",
          recordId: "crm_customers_001",
          matchedFields: ["email"],
          confidence: "high",
          suggestedSensitivity: "direct_identifier",
        },
      ],
      knownRecordIds: new Set(["crm_customers_001"]),
    });

    expect(result.executedActionIds).toEqual(["act_bq_1"]);
    expect(executed.some((sql) => sql.includes("DELETE FROM"))).toBe(true);
    expect(executed.some((sql) => sql.includes("UNNEST(@recordIds)"))).toBe(true);
  });

  it("rejects non-allowlisted subjects in demo mode", async () => {
    const runner: BigQueryQueryRunner = {
      async query() {
        return { rows: [] };
      },
    };

    const adapter = new BigQueryWarehouseAdapter(
      { projectId: PLANTED_PROJECT, dataset: "consentops_demo" },
      runner,
    );

    await expect(
      adapter.scanSubject({ ...demoSubject, id: "subj_not_allowed" }),
    ).rejects.toThrow(/Demo mode restricts/);
  });
});
