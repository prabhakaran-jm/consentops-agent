import { beforeEach, describe, expect, it } from "vitest";

import { POST as postAgentScanRoute } from "@/app/api/agent/scan/route";
import { resetDemoWorkflowStateForTests } from "@/lib/demo/demoWorkflowState";

describe("POST /api/agent/scan", () => {
  beforeEach(() => {
    resetDemoWorkflowStateForTests();
  });

  it("returns scan summary without a plan", async () => {
    const response = await postAgentScanRoute(
      new Request("http://localhost/api/agent/scan", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.capability).toBe("scan_only");
    expect(body.disclaimer).toMatch(/does not plan or execute cleanup/i);
    expect(body.scan.beforeCount).toBe(37);
    expect(body.scan.matchCount).toBe(37);
    expect(body.scan.fivetran.connectionCount).toBeGreaterThan(0);
    expect(body.scan.mcpTrace).toHaveLength(5);
    expect(body.scan.pipelineLineage.length).toBeGreaterThan(0);
    expect(body.scan.mcpToolsRun).toBe(5);
    expect(body.scan.warehouseScanContext.scanSource).toBe("local_json");
    expect(body.scan.warehouseScanContext.fixtureMatchCount).toBe(37);
    expect(body.summaryForAgent.recordsFound).toBe(37);
    expect(body.plan).toBeUndefined();
  });

  it("rejects execution-shaped payloads", async () => {
    const response = await postAgentScanRoute(
      new Request("http://localhost/api/agent/scan", {
        method: "POST",
        body: JSON.stringify({ approvalId: "bad" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/execution fields/i);
  });
});
