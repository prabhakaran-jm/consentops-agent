import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import type {
  CleanupPlan,
  ConsentSubject,
  DataMatch,
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
  dryRunCleanup(plan: CleanupPlan, actionIds: string[]): Promise<DryRunCleanupResult[]>;
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

const notImplemented = (method: string): never => {
  throw new Error(
    `BigQueryWarehouse.${method} is a production placeholder and is not implemented yet.`,
  );
};

/**
 * Production BigQuery warehouse adapter placeholder.
 *
 * WARNING: Do not use this placeholder with real personal data in the hackathon demo.
 * Any production usage requires privacy, legal, and security review first.
 * Destructive BigQuery DML must remain approval-gated and record-scoped when implemented.
 *
 * TODO: Use @google-cloud/bigquery with Application Default Credentials or a service account.
 * TODO: Parameterize all subject identifiers — never interpolate raw PII into SQL strings.
 * TODO: Enforce record-scoped DML only; reject table-wide deletes at query-build time.
 * TODO: Call existing safety policy helpers before executeApprovedCleanup runs any job.
 * TODO: Wire into a factory that selects the local JSON warehouse for demo mode.
 */
export class BigQueryWarehouseAdapter implements BigQueryWarehouse {
  constructor(private readonly config: BigQueryWarehouseConfig) {}

  static fromEnv(): BigQueryWarehouseAdapter | null {
    const config = getBigQueryConfigFromEnv();
    return config ? new BigQueryWarehouseAdapter(config) : null;
  }

  private assertConfigured(): void {
    if (!this.config.projectId.trim() || !this.config.dataset.trim()) {
      throw new Error(
        "BigQuery warehouse requires GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET.",
      );
    }
  }

  async scanSubject(subject: ConsentSubject): Promise<DataMatch[]> {
    this.assertConfigured();
    // TODO: Run parameterized discovery queries across configured tables in this.config.dataset.
    void subject;
    return notImplemented("scanSubject");
  }

  async dryRunCleanup(plan: CleanupPlan, actionIds: string[]): Promise<DryRunCleanupResult[]> {
    this.assertConfigured();
    // TODO: Build record-scoped UPDATE/DELETE statements and run BigQuery dry-run for each action.
    void plan;
    void actionIds;
    return notImplemented("dryRunCleanup");
  }

  async executeApprovedCleanup(
    input: ExecuteApprovedCleanupInput,
  ): Promise<ExecuteApprovedCleanupResult> {
    this.assertConfigured();
    // TODO: Require non-null approval; execute only approvedActionIds from input.plan.
    void input;
    return notImplemented("executeApprovedCleanup");
  }

  async verifyCleanup(subject: ConsentSubject): Promise<VerifyCleanupResult> {
    this.assertConfigured();
    // TODO: Re-run scanSubject and compare against expected post-cleanup state.
    void subject;
    return notImplemented("verifyCleanup");
  }
}
