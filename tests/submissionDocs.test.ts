import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("submission docs", () => {
  const videoScript = readFileSync(resolve(process.cwd(), "docs/demo-video-script.md"), "utf8");
  const devpost = readFileSync(resolve(process.cwd(), "docs/devpost-submission.md"), "utf8");
  const cloudRun = readFileSync(resolve(process.cwd(), "docs/cloud-run-deployment.md"), "utf8");

  it("demo video script is honest about synthetic data and safety", () => {
    expect(videoScript).toMatch(/synthetic data only/i);
    expect(videoScript).toMatch(/compliance guarantee/i);
    expect(videoScript).toMatch(/Do not claim in the video/i);
    expect(videoScript).not.toMatch(/GDPR certified/i);
  });

  it("devpost copy states operational agent positioning", () => {
    expect(devpost).toMatch(/not a compliance guarantee/i);
    expect(devpost).toMatch(/Synthetic demo data only/i);
    expect(devpost).toMatch(/human approval/i);
    expect(devpost).toMatch(/fivetran-mcp-evidence/i);
    expect(devpost).toMatch(/Option 1 MCP.*primary/i);
  });

  it("agent builder setup doc wires chat front-end to read-only plan API", () => {
    const guide = readFileSync(resolve(process.cwd(), "docs/agent-builder-setup.md"), "utf8");
    expect(guide).toMatch(/Agent Builder/i);
    expect(guide).toMatch(/consentOpsScanAndPlan|consentOps_scan_and_plan/i);
    expect(guide).toMatch(/POST \/api\/agent\/plan|api\/agent\/plan/i);
    expect(guide).toMatch(/approve.*execute|Execute approved cleanup/i);
    expect(guide).toMatch(/What stays out of Agent Builder|execution stays in the web UI/i);
    expect(guide).toMatch(/POST \/api\/execute.*Human approval|Human approval gate/i);
  });

  it("cloud run doc includes Secret Manager checklist", () => {
    expect(cloudRun).toMatch(/Secret Manager for `GEMINI_API_KEY`/);
    expect(cloudRun).toMatch(/--set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest/);
    expect(cloudRun).toMatch(/demo-video-script\.md/);
  });
});
