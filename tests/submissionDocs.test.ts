import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("technical docs", () => {
  const cloudRun = readFileSync(resolve(process.cwd(), "docs/cloud-run-deployment.md"), "utf8");
  const agentBuilder = readFileSync(resolve(process.cwd(), "docs/agent-builder-setup.md"), "utf8");
  const fivetranMcp = readFileSync(resolve(process.cwd(), "docs/fivetran-mcp.md"), "utf8");

  it("cloud run doc covers deploy basics and demo state", () => {
    expect(cloudRun).toMatch(/max-instances=1/i);
    expect(cloudRun).toMatch(/synthetic/i);
    expect(cloudRun).not.toMatch(/devpost/i);
  });

  it("agent builder doc wires chat to read-only scan and plan APIs", () => {
    expect(agentBuilder).toMatch(/consentOpsScanWarehouse|consentOpsBuildPlan/i);
    expect(agentBuilder).toMatch(/\/api\/agent\/scan/);
    expect(agentBuilder).toMatch(/\/api\/agent\/plan/);
    expect(agentBuilder).toMatch(/execution stays in the web UI|Human approval/i);
  });

  it("fivetran mcp doc declares read-only integration", () => {
    expect(fivetranMcp).toMatch(/FIVETRAN_ALLOW_WRITES=false/i);
    expect(fivetranMcp).toMatch(/list_connections/);
    expect(fivetranMcp).toMatch(/Never commit/i);
  });
});
