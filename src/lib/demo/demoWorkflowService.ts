import { planConsentCleanup, type PlannerSource } from "@/lib/agent/consentPlanner";
import type { CleanupPlan } from "@/lib/warehouse/types";
import { generateAuditReport, type ConsentOpsAuditReport } from "@/lib/audit/auditReport";
import { getFivetranAdapter } from "@/lib/connectors/fivetranAdapterFactory";
import { discoverFivetranPipelineViaMcp } from "@/lib/connectors/fivetranPipelineDiscovery";
import { getFivetranConnectorPanelData } from "@/lib/connectors/fivetranPanelData";
import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import { getEmailSha256 } from "@/lib/demo/seedData";
import {
  getDemoWorkflowState,
  updateDemoWorkflowState,
} from "@/lib/demo/demoWorkflowState";
import { buildDataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type { ConsentSubject, DataMatch } from "@/lib/warehouse/types";
import {
  executeApprovedForWorkflow,
  resolveWarehouseTablesScanned,
  scanSubjectForWorkflow,
} from "@/lib/warehouse/warehouseFactory";

const cloneMatches = (matches: DataMatch[]): DataMatch[] => matches.map((match) => ({ ...match }));

export type DemoPlanResult = {
  plan: CleanupPlan;
  source: PlannerSource;
  warning?: string;
  blockedActions: string[];
};

export class DemoWorkflowError extends Error {
  code: "cleanup_plan_required";

  constructor(code: "cleanup_plan_required", message: string) {
    super(message);
    this.code = code;
  }
}

export const runDemoScan = async (subjectOverride?: ConsentSubject) => {
  const state = getDemoWorkflowState();
  const subject = subjectOverride ?? state.subject;
  const [fivetran, { matches, scanSource }, pipelineDiscovery] = await Promise.all([
    getFivetranConnectorPanelData(),
    scanSubjectForWorkflow(subject, state.tables),
    discoverFivetranPipelineViaMcp(),
  ]);
  const spreadMap = buildDataSpreadMap(matches);
  updateDemoWorkflowState({ latestScanMatches: cloneMatches(matches) });

  return {
    subject,
    fivetran,
    matches,
    spreadMap,
    beforeCount: matches.length,
    scanSource,
    mcpTrace: pipelineDiscovery.mcpTrace,
    pipelineLineage: pipelineDiscovery.pipelineLineage,
    fivetranDiscoverySource: pipelineDiscovery.discoverySource,
    mcpToolsRun: pipelineDiscovery.toolsRun,
  };
};

export const buildDemoPlan = async (input?: {
  subject?: Partial<ConsentSubject>;
  matches?: DataMatch[];
}) => {
  const currentState = getDemoWorkflowState();
  const subject: ConsentSubject =
    input?.subject && Object.keys(input.subject).length > 0
      ? {
          ...currentState.subject,
          ...input.subject,
          emailSha256:
            input.subject.emailSha256 ??
            (input.subject.email ? getEmailSha256(input.subject.email) : currentState.subject.emailSha256),
        }
      : currentState.subject;

  const matches = input?.matches
    ? cloneMatches(input.matches)
    : (await scanSubjectForWorkflow(subject, currentState.tables)).matches;

  const plannerResult = await planConsentCleanup({ subject, matches });
  updateDemoWorkflowState({
    subject,
    latestScanMatches: cloneMatches(matches),
    latestPlan: plannerResult.plan,
    latestAudit: null,
    latestPlannerSource: plannerResult.source,
    latestPlannerWarning: plannerResult.warning ?? null,
  });
  return plannerResult;
};

export const executeDemoPlan = async (payload: {
  approvalId: string;
  approvedActionIds: string[];
}) => {
  const state = getDemoWorkflowState();
  if (!state.latestPlan) {
    throw new DemoWorkflowError("cleanup_plan_required", "Generate a cleanup plan before execution.");
  }
  const approval: ExecutionApproval = {
    approvalId: payload.approvalId,
    approvedActionIds: payload.approvedActionIds,
    approvedBy: "demo-reviewer",
    approvedAt: new Date().toISOString(),
  };

  const cachedMatches =
    state.latestScanMatches &&
    state.latestPlan &&
    state.latestScanMatches.length === state.latestPlan.totalMatchesBeforeCleanup
      ? cloneMatches(state.latestScanMatches)
      : null;
  const liveMatches =
    cachedMatches ??
    (await scanSubjectForWorkflow(state.subject, state.tables)).matches;
  const actionsToExecute = state.latestPlan.actions.filter((action) =>
    payload.approvedActionIds.includes(action.id),
  );

  const workflowExecution = await executeApprovedForWorkflow({
    subject: state.subject,
    tables: state.tables,
    plan: state.latestPlan,
    actions: actionsToExecute,
    liveMatches,
    approval,
  });

  const connectors = await getFivetranAdapter().listConnectors();

  const audit = generateAuditReport({
    subject: state.subject,
    connectors,
    warehouseTablesScanned: resolveWarehouseTablesScanned(state.tables),
    recordsFoundBefore: liveMatches.length,
    plan: state.latestPlan,
    approval,
    executedActionIds: workflowExecution.executedActionIds,
    recordsRemainingAfter: workflowExecution.afterMatches.length,
    requestId: `req_demo_${Date.now()}`,
  });

  updateDemoWorkflowState({
    tables: workflowExecution.tables,
    latestAudit: audit,
  });

  return {
    execution: {
      tables: workflowExecution.tables,
      executedActionIds: workflowExecution.executedActionIds,
    },
    afterCount: workflowExecution.afterMatches.length,
    audit,
    executionBackend: workflowExecution.executionBackend,
  };
};

export const getLatestDemoAudit = async (): Promise<ConsentOpsAuditReport | null> => {
  const state = getDemoWorkflowState();
  if (!state.latestAudit) {
    return null;
  }
  return state.latestAudit;
};
