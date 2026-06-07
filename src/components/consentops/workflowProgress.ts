export type WorkflowPhase = "scan" | "plan" | "approve" | "execute" | "audit";

export type PhaseState = "pending" | "current" | "complete";

export type WorkflowProgressInput = {
  scanComplete: boolean;
  planComplete: boolean;
  approvalReady: boolean;
  executionComplete: boolean;
  auditComplete: boolean;
};

export function resolveWorkflowPhaseStates(
  input: WorkflowProgressInput,
): Record<WorkflowPhase, PhaseState> {
  const {
    scanComplete,
    planComplete,
    approvalReady,
    executionComplete,
    auditComplete,
  } = input;

  const approveComplete = executionComplete || approvalReady;

  if (!scanComplete) {
    return {
      scan: "current",
      plan: "pending",
      approve: "pending",
      execute: "pending",
      audit: "pending",
    };
  }
  if (!planComplete) {
    return {
      scan: "complete",
      plan: "current",
      approve: "pending",
      execute: "pending",
      audit: "pending",
    };
  }
  if (!approveComplete) {
    return {
      scan: "complete",
      plan: "complete",
      approve: "current",
      execute: "pending",
      audit: "pending",
    };
  }
  if (!executionComplete) {
    return {
      scan: "complete",
      plan: "complete",
      approve: "complete",
      execute: "current",
      audit: "pending",
    };
  }
  if (!auditComplete) {
    return {
      scan: "complete",
      plan: "complete",
      approve: "complete",
      execute: "complete",
      audit: "current",
    };
  }
  return {
    scan: "complete",
    plan: "complete",
    approve: "complete",
    execute: "complete",
    audit: "complete",
  };
}
