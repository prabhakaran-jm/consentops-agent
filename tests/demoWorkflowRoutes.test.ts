import { beforeEach, describe, expect, it } from "vitest";

import { GET as getAuditRoute } from "@/app/api/audit/route";
import { POST as postExecuteRoute } from "@/app/api/execute/route";
import { POST as postPlanRoute } from "@/app/api/plan/route";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";

describe("demo workflow routes", () => {
  beforeEach(() => {
    resetDemoWorkflowStateForTests();
  });

  it("GET /api/audit before execution returns no_execution_yet", async () => {
    const response = await getAuditRoute();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "no_execution_yet",
      audit: null,
    });
  });

  it("POST /api/execute before /api/plan returns cleanup_plan_required", async () => {
    const response = await postExecuteRoute(
      new Request("http://localhost/api/execute", {
        method: "POST",
        body: JSON.stringify({
          approvalId: "approval_preplan",
          approvedActionIds: ["act_001"],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "cleanup_plan_required",
      message: "Generate a cleanup plan before execution.",
    });
  });

  it("POST /api/plan rejects invalid payloads with 400", async () => {
    const response = await postPlanRoute(
      new Request("http://localhost/api/plan", {
        method: "POST",
        body: JSON.stringify({ subject: { email: "not-an-email" } }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request payload");
  });

  it("POST /api/execute rejects invalid payloads and extra fields", async () => {
    const invalidResponse = await postExecuteRoute(
      new Request("http://localhost/api/execute", {
        method: "POST",
        body: JSON.stringify({ approvalId: "", approvedActionIds: [] }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(invalidResponse.status).toBe(400);

    const extraFieldResponse = await postExecuteRoute(
      new Request("http://localhost/api/execute", {
        method: "POST",
        body: JSON.stringify({
          approvalId: "approval_with_body",
          approvedActionIds: ["act_001"],
          cleanupActions: [{ id: "caller_supplied" }],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(extraFieldResponse.status).toBe(400);
    const body = await extraFieldResponse.json();
    expect(body.error).toBe("Invalid request payload");
  });
});
