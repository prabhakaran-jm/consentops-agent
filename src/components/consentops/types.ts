import type {
  FivetranMcpTraceStep,
  PipelineLineageEntry,
} from "@/lib/connectors/fivetranPipelineDiscovery";
import type { FivetranAgentToolSource } from "@/lib/connectors/fivetranAgentBridge";
import type { FivetranConnectorPanelData } from "@/lib/connectors/fivetranPanelData";
import type { DataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type { ConsentOpsAuditReport } from "@/lib/audit/auditReport";
import type { CleanupPlan, ConsentSubject, DataMatch } from "@/lib/warehouse/types";

export type ScanResponse = {
  subject: ConsentSubject;
  fivetran: FivetranConnectorPanelData;
  matches: DataMatch[];
  spreadMap: Partial<DataSpreadMap>;
  beforeCount: number;
  mcpTrace: FivetranMcpTraceStep[];
  pipelineLineage: PipelineLineageEntry[];
  fivetranDiscoverySource: FivetranAgentToolSource;
  mcpToolsRun: number;
};

export type PlanProvenance = {
  source: "deterministic" | "gemini";
  warning?: string;
  blockedActions: string[];
};

export type PlanResponse = {
  plan: CleanupPlan;
} & PlanProvenance;

export type ExecuteResponse = {
  execution: { executedActionIds: string[] };
  afterCount: number;
  audit: ConsentOpsAuditReport;
};

export type AuditResponse =
  | { status: "no_execution_yet"; audit: null }
  | { status: "ok"; audit: ConsentOpsAuditReport };
