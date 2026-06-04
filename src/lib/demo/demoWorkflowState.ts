import type { ConsentOpsAuditReport } from "@/lib/audit/auditReport";
import type { PlannerSource } from "@/lib/agent/consentPlanner";
import { demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";
import type { CleanupPlan, ConsentSubject, DataMatch, WarehouseTable } from "@/lib/warehouse/types";

type DemoWorkflowState = {
  subject: ConsentSubject;
  tables: WarehouseTable[];
  latestScanMatches: DataMatch[] | null;
  latestPlan: CleanupPlan | null;
  latestAudit: ConsentOpsAuditReport | null;
  latestPlannerSource: PlannerSource | null;
  latestPlannerWarning: string | null;
};

const cloneTables = (tables: WarehouseTable[]): WarehouseTable[] =>
  tables.map((table) => ({
    ...table,
    records: table.records.map((record) => ({ ...record })),
  }));

const cloneMatches = (matches: DataMatch[]): DataMatch[] =>
  matches.map((match) => ({ ...match, matchedFields: [...match.matchedFields] }));

const createInitialState = (): DemoWorkflowState => ({
  subject: { ...demoSubject },
  tables: cloneTables(demoWarehouseTables),
  latestScanMatches: null,
  latestPlan: null,
  latestAudit: null,
  latestPlannerSource: null,
  latestPlannerWarning: null,
});

const cloneAudit = (audit: ConsentOpsAuditReport): ConsentOpsAuditReport => ({
  ...audit,
  requestSubject: { ...audit.requestSubject },
  connectorsInspected: audit.connectorsInspected.map((c) => ({
    ...c,
    mappedTables: [...c.mappedTables],
  })),
  warehouseTablesScanned: [...audit.warehouseTablesScanned],
  cleanupActionsProposed: audit.cleanupActionsProposed.map((a) => ({
    ...a,
    recordIds: [...a.recordIds],
  })),
  actionsApproved: audit.actionsApproved.map((a) => ({ ...a, recordIds: [...a.recordIds] })),
  actionsExecuted: audit.actionsExecuted.map((a) => ({ ...a, recordIds: [...a.recordIds] })),
  retainedRecordsWithReasons: audit.retainedRecordsWithReasons.map((r) => ({
    ...r,
    recordIds: [...r.recordIds],
  })),
  blockedActions: audit.blockedActions.map((b) => ({ ...b })),
  approval: {
    ...audit.approval,
    approvedActionIds: [...audit.approval.approvedActionIds],
  },
});

let state: DemoWorkflowState = createInitialState();

export const getDemoWorkflowState = (): DemoWorkflowState => ({
  subject: { ...state.subject },
  tables: cloneTables(state.tables),
  latestScanMatches: state.latestScanMatches ? cloneMatches(state.latestScanMatches) : null,
  latestPlan: state.latestPlan
    ? {
        ...state.latestPlan,
        actions: state.latestPlan.actions.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
      }
    : null,
  latestAudit: state.latestAudit ? cloneAudit(state.latestAudit) : null,
  latestPlannerSource: state.latestPlannerSource,
  latestPlannerWarning: state.latestPlannerWarning,
});

export const updateDemoWorkflowState = (next: Partial<DemoWorkflowState>): void => {
  state = {
    ...state,
    ...next,
    tables: next.tables ? cloneTables(next.tables) : state.tables,
    latestPlan: next.latestPlan
      ? { ...next.latestPlan, actions: next.latestPlan.actions.map((a) => ({ ...a, recordIds: [...a.recordIds] })) }
      : (next.latestPlan === null ? null : state.latestPlan),
    latestAudit: next.latestAudit
      ? cloneAudit(next.latestAudit)
      : next.latestAudit === null
        ? null
        : state.latestAudit,
  };
};

export const resetDemoWorkflowStateForTests = (): void => {
  state = createInitialState();
};
