import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readmePath = resolve(process.cwd(), "README.md");

describe("README documentation links", () => {
  const raw = readFileSync(readmePath, "utf8");

  it("includes documentation section with core guides", () => {
    expect(raw).toMatch(/## Documentation/);
    expect(raw).toContain("docs/cloud-run-deployment.md");
    expect(raw).toContain("docs/agent-builder-setup.md");
    expect(raw).toContain("docs/fivetran-mcp.md");
    expect(raw).toContain("docs/bigquery-demo-setup.md");
    expect(raw).toContain("docs/openapi/");
  });

  it("does not reference removed submission docs", () => {
    expect(raw).not.toContain("devpost-submission.md");
    expect(raw).not.toContain("demo-video-script.md");
    expect(raw).not.toContain("submission-checklist.md");
    expect(raw).not.toContain("fivetran-mcp-evidence.md");
  });

  it("includes hosted URL without committed secrets", () => {
    expect(raw).toMatch(/\.run\.app/);
    expect(raw).not.toMatch(/GEMINI_API_KEY=AIza/);
  });
});
