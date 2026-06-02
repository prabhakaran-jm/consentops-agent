import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import type { DataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type { ConsentOpsAuditReport } from "@/lib/audit/auditReport";
import type { CleanupPlan, ConsentSubject, DataMatch } from "@/lib/warehouse/types";

export type ScanResponse = {
  subject: ConsentSubject;
  connectors: FivetranConnector[];
  matches: DataMatch[];
  spreadMap: Partial<DataSpreadMap>;
  beforeCount: number;
};

export type PlanResponse = {
  plan: CleanupPlan;
};

export type ExecuteResponse = {
  execution: { executedActionIds: string[] };
  afterCount: number;
  audit: ConsentOpsAuditReport;
};

export type AuditResponse =
  | { status: "no_execution_yet"; audit: null }
  | { status: "ok"; audit: ConsentOpsAuditReport };
