import type { CleanupAction, CleanupPlan, DataMatch, WarehouseTable } from "@/lib/warehouse/types";

export interface ExecutionApproval {
  approvalId: string;
  approvedActionIds: string[];
  approvedBy: "demo-reviewer";
  approvedAt: string;
}

export interface SafetyPolicyInput {
  action: CleanupAction;
  plan: CleanupPlan;
  approval: ExecutionApproval | null;
  approvalRequired: boolean;
  matchedRecordIds: Set<string>;
  knownRecordIds: Set<string>;
}

export const createRecordIdSet = (tables: WarehouseTable[]): Set<string> =>
  new Set(tables.flatMap((table) => table.records.map((record) => record.id)));

export const createMatchedRecordIdSet = (matches: DataMatch[]): Set<string> =>
  new Set(matches.map((match) => match.recordId));

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const validateCleanupActionSafety = (input: SafetyPolicyInput): void => {
  const { action, plan, approval, approvalRequired, matchedRecordIds, knownRecordIds } = input;

  if (!approval) {
    throw new Error(`Missing approval token for action '${action.id}'.`);
  }
  const approved = approval;
  assert(action.recordIds.length > 0, `Table-wide action is blocked for '${action.id}'.`);
  assert(
    action.recordIds.every((recordId) => !["*", "all", "table_wide", "table-wide"].includes(recordId)),
    `Table-wide action marker is blocked for '${action.id}'.`,
  );

  const actionInPlan = plan.actions.find((planAction) => planAction.id === action.id);
  if (!actionInPlan) {
    throw new Error(`Action '${action.id}' is not present in approved plan '${plan.id}'.`);
  }
  assert(
    approved.approvedActionIds.includes(action.id),
    `Action '${action.id}' is not in approval '${approved.approvalId}'.`,
  );

  // Bind execution to the approved plan: an approved id must not carry an
  // escalated classification, a different table, or an expanded record set.
  assert(
    action.classification === actionInPlan.classification,
    `Action '${action.id}' classification '${action.classification}' does not match approved plan classification '${actionInPlan.classification}'.`,
  );
  assert(
    action.table === actionInPlan.table,
    `Action '${action.id}' table '${action.table}' does not match approved plan table '${actionInPlan.table}'.`,
  );
  const plannedRecordIds = new Set(actionInPlan.recordIds);
  assert(
    action.recordIds.length === actionInPlan.recordIds.length &&
      action.recordIds.every((recordId) => plannedRecordIds.has(recordId)),
    `Action '${action.id}' record set does not match approved plan.`,
  );

  if (action.classification === "delete" || action.classification === "anonymize") {
    assert(approvalRequired, `Destructive action '${action.id}' blocked when approvalRequired=false.`);
  }

  if (
    action.table === "payments_transactions" &&
    (action.classification === "delete" || action.classification === "anonymize")
  ) {
    throw new Error("Payment transaction records cannot be deleted or anonymized automatically.");
  }

  for (const recordId of action.recordIds) {
    assert(knownRecordIds.has(recordId), `Unknown record id '${recordId}' in action '${action.id}'.`);
    assert(
      matchedRecordIds.has(recordId),
      `Action '${action.id}' targets unmatched record id '${recordId}'.`,
    );
  }
};
