import { beforeEach, describe, expect, it } from "vitest";

import {
  buildDemoPlan,
  executeDemoPlan,
  getLatestDemoAudit,
  runDemoScan,
} from "@/lib/demo/demoWorkflowService";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";

describe("demo workflow service", () => {
  beforeEach(() => {
    resetDemoWorkflowStateForTests();
  });

  it("scan returns subject, fivetran status, matches, spread map and beforeCount", async () => {
    const result = await runDemoScan();

    expect(result.subject.fullName).toBe("Ana Reyes");
    expect(result.fivetran.connectionCount).toBeGreaterThan(0);
    expect(result.fivetran.mode).toBe("mock");
    expect(result.fivetran.connectors.every((c) => c.displayKey.startsWith("connector_"))).toBe(
      true,
    );
    expect(JSON.stringify(result.fivetran)).not.toContain("conn_zendesk_mock");
    expect(result.matches.length).toBe(37);
    expect(result.beforeCount).toBe(37);
    expect(result.spreadMap.crm_customers?.totalMatches).toBe(3);
  });

  it("getLatestDemoAudit returns null before any execution", async () => {
    const audit = await getLatestDemoAudit();
    expect(audit).toBeNull();
  });

  it("plan returns cleanup plan using defaults with planner provenance", async () => {
    const result = await buildDemoPlan();
    expect(result.plan.totalMatchesBeforeCleanup).toBe(37);
    expect(result.plan.actions.length).toBeGreaterThan(0);
    expect(result.source).toBe("deterministic");
    expect(result.blockedActions.length).toBeGreaterThan(0);
  });

  it("execute runs approved actions only and returns after count", async () => {
    const { plan } = await buildDemoPlan();
    const approved = plan.actions
      .filter((action) => action.classification === "delete")
      .slice(0, 2)
      .map((action) => action.id);

    const result = await executeDemoPlan({
      approvalId: "approval_demo_001",
      approvedActionIds: approved,
    });

    expect(result.execution.executedActionIds).toEqual(approved);
    expect(result.afterCount).toBeLessThan(37);
  });

  it("execute rejects before plan is generated", async () => {
    await expect(
      executeDemoPlan({
        approvalId: "approval_demo_preplan",
        approvedActionIds: ["act_001"],
      }),
    ).rejects.toMatchObject({
      code: "cleanup_plan_required",
      message: "Generate a cleanup plan before execution.",
    });
  });

  it("audit returns latest report", async () => {
    const { plan } = await buildDemoPlan();
    await executeDemoPlan({
      approvalId: "approval_demo_002",
      approvedActionIds: [plan.actions[0]!.id],
    });

    const audit = await getLatestDemoAudit();
    expect(audit).not.toBeNull();
    expect(audit!.id.startsWith("audit_")).toBe(true);
    expect(audit!.approval.approvedBy).toBe("demo-reviewer");
    expect(audit!.recordsFoundBefore).toBeGreaterThan(0);
  });

  it("normal scan -> plan -> execute -> audit flow works", async () => {
    const scan = await runDemoScan();
    expect(scan.beforeCount).toBe(37);

    const { plan } = await buildDemoPlan();
    const approvedActionIds = plan.actions.slice(0, 2).map((action) => action.id);
    const execution = await executeDemoPlan({
      approvalId: "approval_demo_flow",
      approvedActionIds,
    });

    expect(execution.execution.executedActionIds).toEqual(approvedActionIds);
    const audit = await getLatestDemoAudit();
    expect(audit).not.toBeNull();
  });

  it("clears stale audit when a new plan is generated", async () => {
    await runDemoScan();
    const firstPlan = await buildDemoPlan();
    await executeDemoPlan({
      approvalId: "approval_demo_stale_audit",
      approvedActionIds: [firstPlan.plan.actions[0]!.id],
    });

    const auditAfterExecute = await getLatestDemoAudit();
    expect(auditAfterExecute).not.toBeNull();

    await buildDemoPlan();
    const auditAfterNewPlan = await getLatestDemoAudit();
    expect(auditAfterNewPlan).toBeNull();
  });
});
