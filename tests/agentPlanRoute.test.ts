import { beforeEach, describe, expect, it } from "vitest";

import { POST as postAgentPlanRoute } from "@/app/api/agent/plan/route";
import { POST as postAgentScanRoute } from "@/app/api/agent/scan/route";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";

describe("POST /api/agent/plan", () => {
  beforeEach(() => {
    resetDemoWorkflowStateForTests();
  });

  it("returns plan with planner provenance after scan", async () => {
    await postAgentScanRoute(
      new Request("http://localhost/api/agent/scan", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await postAgentPlanRoute(
      new Request("http://localhost/api/agent/plan", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.capability).toBe("plan_only");
    expect(body.disclaimer).toMatch(/does not execute cleanup/i);
    expect(body.plan.totalMatchesBeforeCleanup).toBe(37);
    expect(body.source).toBe("deterministic");
    expect(Array.isArray(body.blockedActions)).toBe(true);
    expect(body.summaryForAgent.recordsFound).toBe(37);
    expect(body.summaryForAgent.actionsByClassification.delete).toBeGreaterThan(0);
    expect(body.scan).toBeUndefined();
  });

  it("rejects execution-shaped payloads with approval fields", async () => {
    const response = await postAgentPlanRoute(
      new Request("http://localhost/api/agent/plan", {
        method: "POST",
        body: JSON.stringify({
          approvalId: "approval_agent_bad",
          approvedActionIds: ["act_001"],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/execution fields/i);
    expect(body.error).toMatch(/approvalId/);
    expect(body.error).toMatch(/web UI/i);
  });

  it("rejects execute and cleanupActions fields", async () => {
    const response = await postAgentPlanRoute(
      new Request("http://localhost/api/agent/plan", {
        method: "POST",
        body: JSON.stringify({
          execute: true,
          cleanupActions: [{ id: "act_001" }],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/execute/);
    expect(body.error).toMatch(/cleanupActions/);
  });

  it("rejects invalid subject payloads with 400", async () => {
    const response = await postAgentPlanRoute(
      new Request("http://localhost/api/agent/plan", {
        method: "POST",
        body: JSON.stringify({ subject: { email: "not-an-email" } }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request payload");
  });
});
