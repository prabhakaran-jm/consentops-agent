import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readmePath = resolve(process.cwd(), "README.md");

describe("README platform proof section", () => {
  const raw = readFileSync(readmePath, "utf8");

  it("includes platform proof section with real-vs-mocked table", () => {
    expect(raw).toMatch(/## Platform proof \(hackathon\)/);
    expect(raw).toMatch(/### Real vs mocked/);
    expect(raw).toMatch(/\*\*IMPLEMENTED\*\*/);
    expect(raw).toMatch(/\*\*STUBBED\*\*/);
    expect(raw).toMatch(/\*\*EXTERNAL\/MANUAL\*\*/);
  });

  it("links to proof documents without claiming MCP is completed", () => {
    expect(raw).toContain("docs/platform-proof-plan.md");
    expect(raw).toContain("docs/fivetran-mcp-evidence.md");
    expect(raw).toContain("docs/openapi/");
    expect(raw).toMatch(/COMPLETED.*or.*disclaim/i);
  });

  it("includes hosted URL placeholder and pre-submission gate", () => {
    expect(raw).toMatch(/Cloud Run URL/);
    expect(raw).toMatch(/YOUR_CLOUD_RUN_URL|Add after deploy/i);
    expect(raw).toMatch(/Pre-submission gate/);
    expect(raw).not.toMatch(/GEMINI_API_KEY=AIza/);
  });
});
