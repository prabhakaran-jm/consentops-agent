import { demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";
import type { AuditReport, CleanupPlan, ConsentSubject, WarehouseTable } from "@/lib/warehouse/types";

type DemoWorkflowState = {
  subject: ConsentSubject;
  tables: WarehouseTable[];
  latestPlan: CleanupPlan | null;
  latestAudit: AuditReport | null;
};

const cloneTables = (tables: WarehouseTable[]): WarehouseTable[] =>
  tables.map((table) => ({
    ...table,
    records: table.records.map((record) => ({ ...record })),
  }));

const createInitialState = (): DemoWorkflowState => ({
  subject: { ...demoSubject },
  tables: cloneTables(demoWarehouseTables),
  latestPlan: null,
  latestAudit: null,
});

let state: DemoWorkflowState = createInitialState();

export const getDemoWorkflowState = (): DemoWorkflowState => ({
  subject: { ...state.subject },
  tables: cloneTables(state.tables),
  latestPlan: state.latestPlan
    ? {
        ...state.latestPlan,
        actions: state.latestPlan.actions.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
      }
    : null,
  latestAudit: state.latestAudit
    ? {
        ...state.latestAudit,
        retainedRecords: state.latestAudit.retainedRecords.map((action) => ({
          ...action,
          recordIds: [...action.recordIds],
        })),
      }
    : null,
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
      ? {
          ...next.latestAudit,
          retainedRecords: next.latestAudit.retainedRecords.map((a) => ({
            ...a,
            recordIds: [...a.recordIds],
          })),
        }
      : (next.latestAudit === null ? null : state.latestAudit),
  };
};

export const resetDemoWorkflowStateForTests = (): void => {
  state = createInitialState();
};
