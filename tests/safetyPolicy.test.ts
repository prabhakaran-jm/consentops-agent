import { describe, expect, it } from "vitest";

import {
  type ExecutionApproval,
  validateCleanupActionSafety,
} from "@/lib/execution/safetyPolicy";
import type { CleanupAction, CleanupPlan, DataMatch } from "@/lib/warehouse/types";

const baseAction: CleanupAction = {
  id: "act_delete_1",
  table: "crm_customers",
  recordIds: ["crm_customers_001"],
  classification: "delete",
  fields: ["email", "customerId"],
};

const basePlan: CleanupPlan = {
  id: "plan_001",
  subjectId: "subj_1",
  createdAtIso: "2026-06-02T09:00:00.000Z",
  totalMatchesBeforeCleanup: 1,
  actions: [baseAction],
};

const baseApproval: ExecutionApproval = {
  approvalId: "approval_001",
  approvedActionIds: ["act_delete_1"],
  approvedBy: "demo-reviewer",
  approvedAt: "2026-06-02T09:05:00.000Z",
};

const baseMatches: DataMatch[] = [
  {
    table: "crm_customers",
    recordId: "crm_customers_001",
    matchedFields: ["email", "customerId"],
    confidence: "high",
    suggestedSensitivity: "direct_identifier",
  },
];

describe("validateCleanupActionSafety", () => {
  it("rejects missing approval token", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: baseAction,
        plan: basePlan,
        approval: null,
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/Missing approval token/);
  });

  it("rejects table-wide delete markers", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: { ...baseAction, recordIds: ["*"] },
        plan: { ...basePlan, actions: [{ ...baseAction, recordIds: ["*"] }] },
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/Table-wide action marker/);
  });

  it("rejects unknown record ids", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: { ...baseAction, recordIds: ["missing_001"] },
        plan: { ...basePlan, actions: [{ ...baseAction, recordIds: ["missing_001"] }] },
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(["missing_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/Unknown record id/);
  });

  it("rejects action not present in approved plan", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: { ...baseAction, id: "act_not_in_plan" },
        plan: basePlan,
        approval: { ...baseApproval, approvedActionIds: ["act_not_in_plan"] },
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/not present in approved plan/);
  });

  it("rejects destructive action when approvalRequired is false", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: baseAction,
        plan: basePlan,
        approval: baseApproval,
        approvalRequired: false,
        matchedRecordIds: new Set(["crm_customers_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/approvalRequired=false/);
  });

  it("rejects delete on payments_transactions", () => {
    const action: CleanupAction = {
      ...baseAction,
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
    };
    const plan: CleanupPlan = { ...basePlan, actions: [action] };

    expect(() =>
      validateCleanupActionSafety({
        action,
        plan,
        approval: { ...baseApproval, approvedActionIds: [action.id] },
        approvalRequired: true,
        matchedRecordIds: new Set(["payments_transactions_001"]),
        knownRecordIds: new Set(["payments_transactions_001"]),
      }),
    ).toThrow("Payment transaction records cannot be deleted or anonymized automatically.");
  });

  it("rejects anonymize on payments_transactions", () => {
    const action: CleanupAction = {
      ...baseAction,
      id: "act_anon_pay_1",
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
      classification: "anonymize",
    };
    const plan: CleanupPlan = { ...basePlan, actions: [action] };
    const approval: ExecutionApproval = {
      ...baseApproval,
      approvedActionIds: [action.id],
    };

    expect(() =>
      validateCleanupActionSafety({
        action,
        plan,
        approval,
        approvalRequired: true,
        matchedRecordIds: new Set(["payments_transactions_001"]),
        knownRecordIds: new Set(["payments_transactions_001"]),
      }),
    ).toThrow("Payment transaction records cannot be deleted or anonymized automatically.");
  });

  it("rejects action on unmatched record", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: baseAction,
        plan: basePlan,
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_999"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/unmatched record id/);
  });

  it("rejects classification escalation beyond the approved plan", () => {
    // Plan/approval authorize a non-destructive review of this record.
    const plannedReview: CleanupAction = { ...baseAction, classification: "review" };
    const plan: CleanupPlan = { ...basePlan, actions: [plannedReview] };

    // Executor is handed the same id but escalated to a destructive delete.
    expect(() =>
      validateCleanupActionSafety({
        action: { ...baseAction, classification: "delete" },
        plan,
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_001"]),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).toThrow(/does not match approved plan/);
  });

  it("rejects record-set expansion beyond the approved plan", () => {
    // Plan/approval authorize exactly one record.
    const plan: CleanupPlan = { ...basePlan, actions: [baseAction] };

    // Executor is handed the same id but a wider record set.
    expect(() =>
      validateCleanupActionSafety({
        action: { ...baseAction, recordIds: ["crm_customers_001", "crm_customers_002"] },
        plan,
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(["crm_customers_001", "crm_customers_002"]),
        knownRecordIds: new Set(["crm_customers_001", "crm_customers_002"]),
      }),
    ).toThrow(/does not match approved plan/);
  });

  it("allows valid approved action", () => {
    expect(() =>
      validateCleanupActionSafety({
        action: baseAction,
        plan: basePlan,
        approval: baseApproval,
        approvalRequired: true,
        matchedRecordIds: new Set(baseMatches.map((match) => match.recordId)),
        knownRecordIds: new Set(["crm_customers_001"]),
      }),
    ).not.toThrow();
  });

  it("allows retain on payments_transactions", () => {
    const action: CleanupAction = {
      ...baseAction,
      id: "act_retain_pay_1",
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
      classification: "retain",
      retainReason: "Financial retention review required",
    };
    const plan: CleanupPlan = { ...basePlan, actions: [action] };
    const approval: ExecutionApproval = {
      ...baseApproval,
      approvedActionIds: [action.id],
    };

    expect(() =>
      validateCleanupActionSafety({
        action,
        plan,
        approval,
        approvalRequired: true,
        matchedRecordIds: new Set(["payments_transactions_001"]),
        knownRecordIds: new Set(["payments_transactions_001"]),
      }),
    ).not.toThrow();
  });

  it("allows review on payments_transactions when plan and approval match", () => {
    const action: CleanupAction = {
      ...baseAction,
      id: "act_review_pay_1",
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
      classification: "review",
    };
    const plan: CleanupPlan = { ...basePlan, actions: [action] };
    const approval: ExecutionApproval = {
      ...baseApproval,
      approvedActionIds: [action.id],
    };

    expect(() =>
      validateCleanupActionSafety({
        action,
        plan,
        approval,
        approvalRequired: true,
        matchedRecordIds: new Set(["payments_transactions_001"]),
        knownRecordIds: new Set(["payments_transactions_001"]),
      }),
    ).not.toThrow();
  });
});
