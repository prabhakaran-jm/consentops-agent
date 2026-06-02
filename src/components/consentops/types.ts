import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import type { DataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type {
  AuditReport,
  CleanupPlan,
  ConsentSubject,
  DataMatch,
} from "@/lib/warehouse/types";

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
  audit: AuditReport;
};

export type AuditResponse =
  | { status: "no_execution_yet"; audit: null }
  | { status: "ok"; audit: AuditReport };
