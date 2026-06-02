import { MATCH_FIELDS } from "@/lib/warehouse/types";
import type { CleanupAction, CleanupPlan, DataMatch, WarehouseRecord, WarehouseTable } from "@/lib/warehouse/types";

import {
  createMatchedRecordIdSet,
  createRecordIdSet,
  type ExecutionApproval,
  validateCleanupActionSafety,
} from "@/lib/execution/safetyPolicy";

export interface ExecuteCleanupInput {
  tables: WarehouseTable[];
  plan: CleanupPlan;
  actions: CleanupAction[];
  matches: DataMatch[];
  approval: ExecutionApproval | null;
  approvalRequired: boolean;
}

export interface ExecuteCleanupResult {
  tables: WarehouseTable[];
  executedActionIds: string[];
}

const redactIdentifiers = (record: WarehouseRecord): WarehouseRecord => {
  const redacted: WarehouseRecord = { ...record };
  if (typeof redacted[MATCH_FIELDS.email] === "string") redacted[MATCH_FIELDS.email] = "[REDACTED]";
  if (typeof redacted[MATCH_FIELDS.phone] === "string") redacted[MATCH_FIELDS.phone] = "[REDACTED]";
  if (typeof redacted[MATCH_FIELDS.customerId] === "string")
    redacted[MATCH_FIELDS.customerId] = "[REDACTED]";
  if (typeof redacted[MATCH_FIELDS.emailSha256] === "string")
    redacted[MATCH_FIELDS.emailSha256] = "[REDACTED]";
  return redacted;
};

export const executeCleanupActions = (input: ExecuteCleanupInput): ExecuteCleanupResult => {
  const workingTables: WarehouseTable[] = input.tables.map((table) => ({
    ...table,
    records: table.records.map((record) => ({ ...record })),
  }));

  const knownRecordIds = createRecordIdSet(workingTables);
  const matchedRecordIds = createMatchedRecordIdSet(input.matches);
  const executedActionIds: string[] = [];

  for (const action of input.actions) {
    validateCleanupActionSafety({
      action,
      plan: input.plan,
      approval: input.approval,
      approvalRequired: input.approvalRequired,
      matchedRecordIds,
      knownRecordIds,
    });

    const targetTable = workingTables.find((table) => table.name === action.table);
    if (!targetTable) {
      throw new Error(`Unknown table '${action.table}' for action '${action.id}'.`);
    }

    if (action.classification === "delete") {
      targetTable.records = targetTable.records.filter((record) => !action.recordIds.includes(record.id));
      executedActionIds.push(action.id);
      continue;
    }

    if (action.classification === "anonymize") {
      targetTable.records = targetTable.records.map((record) =>
        action.recordIds.includes(record.id) ? redactIdentifiers(record) : record,
      );
      executedActionIds.push(action.id);
      continue;
    }

    // retain/review are intentionally non-mutating but considered executed once approved.
    executedActionIds.push(action.id);
  }

  return { tables: workingTables, executedActionIds };
};
