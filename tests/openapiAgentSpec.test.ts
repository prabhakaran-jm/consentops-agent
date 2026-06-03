import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const specPath = resolve(process.cwd(), "docs/openapi/consentops-agent.yaml");

describe("consentops-agent OpenAPI spec", () => {
  const raw = readFileSync(specPath, "utf8");

  it("documents only the read-only agent plan endpoint", () => {
    expect(raw).toMatch(/^\s*\/api\/agent\/plan:/m);
    expect(raw).not.toMatch(/\/api\/execute:/);
  });

  it("declares scan_and_plan_only capability and planner source", () => {
    expect(raw).toMatch(/scan_and_plan_only/);
    expect(raw).toMatch(/operationId:\s*consentOpsScanAndPlan/);
    expect(raw).toContain("- gemini");
    expect(raw).toContain("- deterministic");
  });

  it("states synthetic-only and documents execute is omitted from paths", () => {
    expect(raw).toMatch(/Synthetic data only/i);
    expect(raw).not.toMatch(/^\s*\/api\/execute:/m);
    expect(raw).toMatch(/omitted from this spec/i);
  });
});
