import { describe, expect, it } from "vitest";

import { executeCleanupActions } from "@/lib/execution/cleanupExecutor";
import type { CleanupAction, CleanupPlan, DataMatch, WarehouseTable } from "@/lib/warehouse/types";

const baseTables: WarehouseTable[] = [
  {
    name: "crm_customers",
    records: [
      { id: "crm_customers_001", email: "ana.reyes@example.com", customerId: "cus_1029", phone: "+1-555-0188" },
      { id: "crm_customers_002", email: "other@example.com", customerId: "cus_9999" },
    ],
  },
  {
    name: "payments_transactions",
    records: [{ id: "payments_transactions_001", email: "ana.reyes@example.com", customerId: "cus_1029", amount: 95 }],
  },
];

const matches: DataMatch[] = [
  {
    table: "crm_customers",
    recordId: "crm_customers_001",
    matchedFields: ["email", "customerId", "phone"],
    confidence: "high",
    suggestedSensitivity: "direct_identifier",
  },
  {
    table: "payments_transactions",
    recordId: "payments_transactions_001",
    matchedFields: ["email", "customerId"],
    confidence: "high",
    suggestedSensitivity: "transaction_record",
  },
];

const approval = {
  approvalId: "approval_1",
  approvedActionIds: ["act_delete", "act_anonymize", "act_retain", "act_review"],
  approvedBy: "demo-reviewer" as const,
  approvedAt: "2026-06-02T09:30:00.000Z",
};

describe("executeCleanupActions", () => {
  it("delete removes only specific record ids", () => {
    const actions: CleanupAction[] = [
      {
        id: "act_delete",
        table: "crm_customers",
        recordIds: ["crm_customers_001"],
        classification: "delete",
        fields: ["email"],
      },
    ];
    const plan: CleanupPlan = {
      id: "plan_1",
      subjectId: "subj_ana",
      createdAtIso: "2026-06-02T09:20:00.000Z",
      totalMatchesBeforeCleanup: 2,
      actions,
    };

    const result = executeCleanupActions({
      tables: baseTables,
      plan,
      actions,
      matches,
      approval,
      approvalRequired: true,
    });

    expect(result.tables[0]?.records.map((record) => record.id)).toEqual(["crm_customers_002"]);
  });

  it("anonymize redacts direct identifiers and keeps shape", () => {
    const actions: CleanupAction[] = [
      {
        id: "act_anonymize",
        table: "crm_customers",
        recordIds: ["crm_customers_001"],
        classification: "anonymize",
        fields: ["email", "phone", "customerId"],
      },
    ];
    const plan: CleanupPlan = {
      id: "plan_2",
      subjectId: "subj_ana",
      createdAtIso: "2026-06-02T09:20:00.000Z",
      totalMatchesBeforeCleanup: 2,
      actions,
    };

    const result = executeCleanupActions({
      tables: baseTables,
      plan,
      actions,
      matches,
      approval: { ...approval, approvedActionIds: ["act_anonymize"] },
      approvalRequired: true,
    });

    const record = result.tables[0]?.records.find((item) => item.id === "crm_customers_001");
    expect(record).toBeDefined();
    expect(record?.email).toBe("[REDACTED]");
    expect(record?.phone).toBe("[REDACTED]");
    expect(record?.customerId).toBe("[REDACTED]");
    expect(Object.keys(record ?? {}).sort()).toEqual(["customerId", "email", "id", "phone"]);
  });

  it("retain and review do not mutate records", () => {
    const actions: CleanupAction[] = [
      {
        id: "act_retain",
        table: "payments_transactions",
        recordIds: ["payments_transactions_001"],
        classification: "retain",
        fields: ["email", "customerId", "amount"],
        retainReason: "Financial retention review required",
      },
      {
        id: "act_review",
        table: "crm_customers",
        recordIds: ["crm_customers_001"],
        classification: "review",
        fields: ["email"],
      },
    ];
    const plan: CleanupPlan = {
      id: "plan_3",
      subjectId: "subj_ana",
      createdAtIso: "2026-06-02T09:20:00.000Z",
      totalMatchesBeforeCleanup: 2,
      actions,
    };

    const result = executeCleanupActions({
      tables: baseTables,
      plan,
      actions,
      matches,
      approval: { ...approval, approvedActionIds: ["act_retain", "act_review"] },
      approvalRequired: true,
    });

    expect(result.tables).toEqual(baseTables);
  });

  it("rejects action not in approval list during execution", () => {
    const actions: CleanupAction[] = [
      {
        id: "act_delete",
        table: "crm_customers",
        recordIds: ["crm_customers_001"],
        classification: "delete",
        fields: ["email"],
      },
    ];
    const plan: CleanupPlan = { id: "plan_4", subjectId: "s", createdAtIso: "x", totalMatchesBeforeCleanup: 2, actions };

    expect(() =>
      executeCleanupActions({
        tables: baseTables,
        plan,
        actions,
        matches,
        approval: { ...approval, approvedActionIds: [] },
        approvalRequired: true,
      }),
    ).toThrow(/not in approval/);
  });
});
