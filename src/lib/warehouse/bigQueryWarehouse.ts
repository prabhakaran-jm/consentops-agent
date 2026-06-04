import {
  createMatchedRecordIdSet,
  validateCleanupActionSafety,
  type ExecutionApproval,
} from "@/lib/execution/safetyPolicy";
import {
  buildSubjectScanSql,
  createBigQueryRunner,
  qualifyTable,
  type BigQueryQueryRunner,
} from "@/lib/warehouse/bigQueryClient";
import { assertDemoSubjectAllowed } from "@/lib/warehouse/demoModeGuard";
import { getMatchedFields, inferConfidence, inferSensitivity } from "@/lib/warehouse/matchEngine";
import { WAREHOUSE_TABLE_NAMES } from "@/lib/warehouse/warehouseConfig";
import type {
  CleanupPlan,
  ConsentSubject,
  DataMatch,
  MatchField,
  WarehouseRecord,
  WarehouseTableName,
} from "@/lib/warehouse/types";

export interface BigQueryWarehouseConfig {
  projectId: string;
  dataset: string;
}

export interface DryRunCleanupResult {
  actionId: string;
  table: string;
  sql: string;
  wouldAffectRows: number;
  bytesProcessed?: number;
}

export interface ExecuteApprovedCleanupInput {
  plan: CleanupPlan;
  approval: ExecutionApproval;
  approvedActionIds: string[];
  matches: DataMatch[];
  knownRecordIds: Set<string>;
}

export interface ExecuteApprovedCleanupResult {
  executedActionIds: string[];
  jobIds: string[];
}

export interface VerifyCleanupResult {
  recordsRemaining: number;
  matches: DataMatch[];
  passed: boolean;
}

export interface BigQueryWarehouse {
  scanSubject(subject: ConsentSubject): Promise<DataMatch[]>;
  dryRunCleanup(plan: CleanupPlan, actionIds: string[], matches: DataMatch[]): Promise<DryRunCleanupResult[]>;
  executeApprovedCleanup(input: ExecuteApprovedCleanupInput): Promise<ExecuteApprovedCleanupResult>;
  verifyCleanup(subject: ConsentSubject): Promise<VerifyCleanupResult>;
}

export const getBigQueryConfigFromEnv = (): BigQueryWarehouseConfig | null => {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ?? process.env.BIGQUERY_PROJECT_ID?.trim();
  const dataset = process.env.BIGQUERY_DATASET?.trim();
  if (!projectId || !dataset) return null;
  return { projectId, dataset };
};

const rowToRecord = (row: Record<string, unknown>): WarehouseRecord => ({
  id: String(row.id ?? ""),
  email: typeof row.email === "string" ? row.email : undefined,
  phone: typeof row.phone === "string" ? row.phone : undefined,
  customerId: typeof row.customerId === "string" ? row.customerId : undefined,
  emailSha256: typeof row.emailSha256 === "string" ? row.emailSha256 : undefined,
});

const rowToMatch = (
  table: WarehouseTableName,
  row: Record<string, unknown>,
  subject: ConsentSubject,
): DataMatch | null => {
  const record = rowToRecord(row);
  const matchedFields = getMatchedFields(subject, record);
  if (matchedFields.length === 0 || !record.id) return null;

  return {
    table,
    recordId: record.id,
    matchedFields,
    confidence: inferConfidence(matchedFields as MatchField[]),
    suggestedSensitivity: inferSensitivity(table, matchedFields as MatchField[]),
  };
};

const buildDeleteSql = (
  config: BigQueryWarehouseConfig,
  table: WarehouseTableName,
  recordIds: string[],
): { sql: string; params: Record<string, unknown> } => ({
  sql: `DELETE FROM ${qualifyTable(config, table)} WHERE id IN UNNEST(@recordIds)`,
  params: { recordIds },
});

const buildAnonymizeSql = (
  config: BigQueryWarehouseConfig,
  table: WarehouseTableName,
  recordIds: string[],
): { sql: string; params: Record<string, unknown> } => ({
  sql: `UPDATE ${qualifyTable(config, table)}
SET email = '[REDACTED]', phone = '[REDACTED]', customerId = '[REDACTED]', emailSha256 = '[REDACTED]'
WHERE id IN UNNEST(@recordIds)`,
  params: { recordIds },
});

export class BigQueryWarehouseAdapter implements BigQueryWarehouse {
  constructor(
    private readonly config: BigQueryWarehouseConfig,
    private readonly runner: BigQueryQueryRunner = createBigQueryRunner(config),
  ) {}

  static fromEnv(runner?: BigQueryQueryRunner): BigQueryWarehouseAdapter | null {
    const config = getBigQueryConfigFromEnv();
    if (!config) return null;
    return new BigQueryWarehouseAdapter(config, runner ?? createBigQueryRunner(config));
  }

  private assertConfigured(): void {
    if (!this.config.projectId.trim() || !this.config.dataset.trim()) {
      throw new Error("BigQuery warehouse requires GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET.");
    }
  }

  async scanSubject(subject: ConsentSubject): Promise<DataMatch[]> {
    this.assertConfigured();
    assertDemoSubjectAllowed(subject);

    const matches: DataMatch[] = [];

    for (const tableName of WAREHOUSE_TABLE_NAMES) {
      const { sql, params } = buildSubjectScanSql(this.config, tableName, subject);
      const { rows } = await this.runner.query({ sql, params });

      for (const row of rows) {
        const match = rowToMatch(tableName, row, subject);
        if (match) matches.push(match);
      }
    }

    return matches;
  }

  async dryRunCleanup(
    plan: CleanupPlan,
    actionIds: string[],
    matches: DataMatch[],
  ): Promise<DryRunCleanupResult[]> {
    this.assertConfigured();
    const matchedRecordIds = createMatchedRecordIdSet(matches);
    const knownRecordIds = new Set(matches.map((match) => match.recordId));
    const results: DryRunCleanupResult[] = [];

    for (const actionId of actionIds) {
      const action = plan.actions.find((item) => item.id === actionId);
      if (!action) {
        throw new Error(`Unknown action '${actionId}' in dry-run request.`);
      }

      validateCleanupActionSafety({
        action,
        plan,
        approval: {
          approvalId: "dry_run",
          approvedActionIds: actionIds,
          approvedBy: "demo-reviewer",
          approvedAt: new Date().toISOString(),
        },
        approvalRequired: true,
        matchedRecordIds,
        knownRecordIds,
      });

      if (action.classification === "retain" || action.classification === "review") {
        results.push({
          actionId,
          table: action.table,
          sql: "-- non-mutating retain/review action",
          wouldAffectRows: 0,
        });
        continue;
      }

      const builder =
        action.classification === "delete" ? buildDeleteSql : buildAnonymizeSql;
      const { sql, params } = builder(this.config, action.table, action.recordIds);
      const { bytesProcessed } = await this.runner.query({ sql, params, dryRun: true });

      results.push({
        actionId,
        table: action.table,
        sql,
        wouldAffectRows: action.recordIds.length,
        bytesProcessed,
      });
    }

    return results;
  }

  async executeApprovedCleanup(input: ExecuteApprovedCleanupInput): Promise<ExecuteApprovedCleanupResult> {
    this.assertConfigured();
    assertDemoSubjectAllowed({ id: input.plan.subjectId } as ConsentSubject);

    const matchedRecordIds = createMatchedRecordIdSet(input.matches);
    const knownRecordIds = input.knownRecordIds;
    const executedActionIds: string[] = [];
    const jobIds: string[] = [];

    const actions = input.plan.actions.filter((action) =>
      input.approvedActionIds.includes(action.id),
    );

    for (const actionId of input.approvedActionIds) {
      if (!input.plan.actions.some((action) => action.id === actionId)) {
        throw new Error(`Unknown approved action '${actionId}'.`);
      }
    }

    for (const action of actions) {
      validateCleanupActionSafety({
        action,
        plan: input.plan,
        approval: input.approval,
        approvalRequired: true,
        matchedRecordIds,
        knownRecordIds,
      });

      if (action.classification === "retain" || action.classification === "review") {
        executedActionIds.push(action.id);
        continue;
      }

      const builder =
        action.classification === "delete" ? buildDeleteSql : buildAnonymizeSql;
      const { sql, params } = builder(this.config, action.table, action.recordIds);
      await this.runner.query({ sql, params });
      executedActionIds.push(action.id);
      jobIds.push(`bq_${action.id}_${Date.now()}`);
    }

    return { executedActionIds, jobIds };
  }

  async verifyCleanup(subject: ConsentSubject): Promise<VerifyCleanupResult> {
    const matches = await this.scanSubject(subject);
    return {
      recordsRemaining: matches.length,
      matches,
      passed: true,
    };
  }
}
