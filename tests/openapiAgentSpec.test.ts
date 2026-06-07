import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const specPath = resolve(process.cwd(), "docs/openapi/consentops-agent.yaml");

describe("consentops-agent OpenAPI spec", () => {
  const raw = readFileSync(specPath, "utf8");

  it("documents read-only agent scan and plan endpoints", () => {
    expect(raw).toMatch(/^\s*\/api\/agent\/scan:/m);
    expect(raw).toMatch(/^\s*\/api\/agent\/plan:/m);
    expect(raw).not.toMatch(/\/api\/execute:/);
  });

  it("declares scan_only and plan_only capabilities", () => {
    expect(raw).toMatch(/scan_only/);
    expect(raw).toMatch(/plan_only/);
    expect(raw).toMatch(/operationId:\s*consentOpsScanWarehouse/);
    expect(raw).toMatch(/operationId:\s*consentOpsBuildPlan/);
    expect(raw).toContain("- gemini");
    expect(raw).toContain("- deterministic");
  });

  it("states synthetic-only and documents execute is omitted from paths", () => {
    expect(raw).toMatch(/Synthetic data only/i);
    expect(raw).not.toMatch(/^\s*\/api\/execute:/m);
    expect(raw).toMatch(/omitted from this spec/i);
  });
});
