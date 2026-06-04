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
  });

  it("cloud run doc includes Secret Manager checklist", () => {
    expect(cloudRun).toMatch(/Secret Manager for `GEMINI_API_KEY`/);
    expect(cloudRun).toMatch(/--set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest/);
    expect(cloudRun).toMatch(/demo-video-script\.md/);
  });
});
