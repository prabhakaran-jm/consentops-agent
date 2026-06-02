import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { executeCleanupActions } from "@/lib/execution/cleanupExecutor";
import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import { demoCleanupPlan, getEmailSha256 } from "@/lib/demo/seedData";
import {
  getDemoWorkflowState,
  updateDemoWorkflowState,
} from "@/lib/demo/demoWorkflowState";
import {
  buildDataSpreadMap,
  scanSubjectAcrossWarehouse,
} from "@/lib/warehouse/localWarehouse";
import type {
  AuditReport,
  CleanupPlan,
  ConsentSubject,
  DataMatch,
} from "@/lib/warehouse/types";

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

const buildPlanFromMatches = (matches: DataMatch[]): CleanupPlan => {
  const allowedRecordIds = new Set(matches.map((match) => match.recordId));
  const actions = demoCleanupPlan.actions.filter((action) =>
    action.recordIds.every((recordId) => allowedRecordIds.has(recordId)),
  );

  return {
    ...demoCleanupPlan,
    id: `plan_demo_${Date.now()}`,
    createdAtIso: new Date().toISOString(),
    totalMatchesBeforeCleanup: matches.length,
    actions: actions.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
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
  const plan = buildPlanFromMatches(matches);
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
  const retainedRecords = state.latestPlan.actions.filter(
    (action) =>
      payload.approvedActionIds.includes(action.id) && action.classification === "retain",
  );

  const audit: AuditReport = {
    id: `audit_demo_${Date.now()}`,
    requestId: `req_demo_${Date.now()}`,
    subjectId: state.subject.id,
    generatedAtIso: new Date().toISOString(),
    approvedBy: approval.approvedBy,
    totalMatchesBeforeCleanup: liveMatches.length,
    remainingMatchesAfterCleanup: postMatches.length,
    retainedRecords: retainedRecords.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
    notes:
      "Demo execution completed with explicit approval. Records are only mutated for approved actions that pass safety policy.",
  };

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

export const getLatestDemoAudit = async (): Promise<AuditReport | null> => {
  const state = getDemoWorkflowState();
  if (!state.latestAudit) {
    return null;
  }
  return state.latestAudit;
};
