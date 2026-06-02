import { planConsentCleanup } from "@/lib/agent/consentPlanner";
import { generateAuditReport, type ConsentOpsAuditReport } from "@/lib/audit/auditReport";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { executeCleanupActions } from "@/lib/execution/cleanupExecutor";
import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import { getEmailSha256 } from "@/lib/demo/seedData";
import {
  getDemoWorkflowState,
  updateDemoWorkflowState,
} from "@/lib/demo/demoWorkflowState";
import {
  buildDataSpreadMap,
  scanSubjectAcrossWarehouse,
} from "@/lib/warehouse/localWarehouse";
import type { ConsentSubject, DataMatch } from "@/lib/warehouse/types";

const fivetranAdapter = new MockFivetranAdapter();

const cloneMatches = (matches: DataMatch[]): DataMatch[] => matches.map((match) => ({ ...match }));

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
  const connectors = await fivetranAdapter.listConnectors();
  const matches = scanSubjectAcrossWarehouse(subject, state.tables);
  const spreadMap = buildDataSpreadMap(matches);

  return {
    subject,
    connectors,
    matches,
    spreadMap,
    beforeCount: matches.length,
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

  const matches = input?.matches ? cloneMatches(input.matches) : scanSubjectAcrossWarehouse(subject, currentState.tables);
  const { plan } = await planConsentCleanup({ subject, matches });
  updateDemoWorkflowState({ subject, latestPlan: plan, latestAudit: null });
  return plan;
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

  const liveMatches = scanSubjectAcrossWarehouse(state.subject, state.tables);
  const actionsToExecute = state.latestPlan.actions.filter((action) =>
    payload.approvedActionIds.includes(action.id),
  );

  const execution = executeCleanupActions({
    tables: state.tables,
    plan: state.latestPlan,
    actions: actionsToExecute,
    matches: liveMatches,
    approval,
    approvalRequired: true,
  });

  const postMatches = scanSubjectAcrossWarehouse(state.subject, execution.tables);
  const connectors = await fivetranAdapter.listConnectors();

  const audit = generateAuditReport({
    subject: state.subject,
    connectors,
    warehouseTablesScanned: state.tables.map((table) => table.name),
    recordsFoundBefore: liveMatches.length,
    plan: state.latestPlan,
    approval,
    executedActionIds: execution.executedActionIds,
    recordsRemainingAfter: postMatches.length,
    requestId: `req_demo_${Date.now()}`,
  });

  updateDemoWorkflowState({
    tables: execution.tables,
    latestAudit: audit,
  });

  return {
    execution,
    afterCount: postMatches.length,
    audit,
  };
};

export const getLatestDemoAudit = async (): Promise<ConsentOpsAuditReport | null> => {
  const state = getDemoWorkflowState();
  if (!state.latestAudit) {
    return null;
  }
  return state.latestAudit;
};
