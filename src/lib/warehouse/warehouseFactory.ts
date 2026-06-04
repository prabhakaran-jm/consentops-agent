import { executeCleanupActions } from "@/lib/execution/cleanupExecutor";
import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import { createMatchedRecordIdSet, createRecordIdSet } from "@/lib/execution/safetyPolicy";
import {
  BigQueryWarehouseAdapter,
  getBigQueryConfigFromEnv,
} from "@/lib/warehouse/bigQueryWarehouse";
import { assertDemoSubjectAllowed } from "@/lib/warehouse/demoModeGuard";
import { scanSubjectAcrossWarehouse } from "@/lib/warehouse/matchEngine";
import { getWarehouseModeFromEnv, type WarehouseMode } from "@/lib/warehouse/warehouseConfig";
import type { CleanupAction, CleanupPlan, ConsentSubject, DataMatch, WarehouseTable } from "@/lib/warehouse/types";

export type ScanSource = "local_json" | "bigquery";

export const getWarehouseMode = (): WarehouseMode => getWarehouseModeFromEnv();

export const getScanSource = (): ScanSource => {
  const mode = getWarehouseMode();
  if (mode === "local_json") return "local_json";
  if (!getBigQueryConfigFromEnv()) {
    throw new Error(
      "CONSENTOPS_WAREHOUSE_MODE requires GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET when using BigQuery.",
    );
  }
  return "bigquery";
};

export const scanSubjectForWorkflow = async (
  subject: ConsentSubject,
  localTables: WarehouseTable[],
): Promise<{ matches: DataMatch[]; scanSource: ScanSource }> => {
  assertDemoSubjectAllowed(subject);
  const scanSource = getScanSource();

  if (scanSource === "local_json") {
    return {
      matches: scanSubjectAcrossWarehouse(subject, localTables),
      scanSource,
    };
  }

  const adapter = BigQueryWarehouseAdapter.fromEnv();
  if (!adapter) {
    throw new Error("BigQuery adapter is not configured.");
  }

  return {
    matches: await adapter.scanSubject(subject),
    scanSource,
  };
};

export type WorkflowExecutionResult = {
  executedActionIds: string[];
  afterMatches: DataMatch[];
  tables: WarehouseTable[];
  executionBackend: "local_json" | "bigquery";
  bigQueryJobIds?: string[];
};

export const executeApprovedForWorkflow = async (input: {
  subject: ConsentSubject;
  tables: WarehouseTable[];
  plan: CleanupPlan;
  actions: CleanupAction[];
  liveMatches: DataMatch[];
  approval: ExecutionApproval;
}): Promise<WorkflowExecutionResult> => {
  assertDemoSubjectAllowed(input.subject);
  const mode = getWarehouseMode();

  if (mode === "bigquery_full") {
    const adapter = BigQueryWarehouseAdapter.fromEnv();
    if (!adapter) {
      throw new Error("BigQuery full mode requires GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET.");
    }

    const knownRecordIds = new Set(input.liveMatches.map((match) => match.recordId));
    const result = await adapter.executeApprovedCleanup({
      plan: input.plan,
      approval: input.approval,
      approvedActionIds: input.actions.map((action) => action.id),
      matches: input.liveMatches,
      knownRecordIds,
    });

    const afterMatches = await adapter.scanSubject(input.subject);

    return {
      executedActionIds: result.executedActionIds,
      afterMatches,
      tables: input.tables,
      executionBackend: "bigquery",
      bigQueryJobIds: result.jobIds,
    };
  }

  const execution = executeCleanupActions({
    tables: input.tables,
    plan: input.plan,
    actions: input.actions,
    matches: input.liveMatches,
    approval: input.approval,
    approvalRequired: true,
  });

  const afterMatches =
    getScanSource() === "bigquery"
      ? await scanSubjectForWorkflow(input.subject, execution.tables).then((r) => r.matches)
      : scanSubjectAcrossWarehouse(input.subject, execution.tables);

  return {
    executedActionIds: execution.executedActionIds,
    afterMatches,
    tables: execution.tables,
    executionBackend: "local_json",
  };
};

export const resolveWarehouseTablesScanned = (
  localTables: WarehouseTable[],
): WarehouseTable["name"][] => localTables.map((table) => table.name);

export { createMatchedRecordIdSet, createRecordIdSet };
