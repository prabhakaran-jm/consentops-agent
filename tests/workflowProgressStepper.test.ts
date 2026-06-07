import { describe, expect, it } from "vitest";

import { resolveWorkflowPhaseStates } from "@/components/consentops/workflowProgress";

describe("resolveWorkflowPhaseStates", () => {
  it("marks execute and audit complete after execution when approval selection was cleared", () => {
    const states = resolveWorkflowPhaseStates({
      scanComplete: true,
      planComplete: true,
      approvalReady: false,
      executionComplete: true,
      auditComplete: true,
    });

    expect(states.approve).toBe("complete");
    expect(states.execute).toBe("complete");
    expect(states.audit).toBe("complete");
  });

  it("shows execute as current when actions are selected", () => {
    const states = resolveWorkflowPhaseStates({
      scanComplete: true,
      planComplete: true,
      approvalReady: true,
      executionComplete: false,
      auditComplete: false,
    });

    expect(states.approve).toBe("complete");
    expect(states.execute).toBe("current");
  });
});
