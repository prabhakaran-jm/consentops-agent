import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const docPath = resolve(process.cwd(), "docs/fivetran-mcp.md");

describe("fivetran MCP doc", () => {
  const raw = readFileSync(docPath, "utf8");

  it("declares read-only MCP integration", () => {
    expect(raw).toMatch(/read-only/i);
    expect(raw).toMatch(/FIVETRAN_ALLOW_WRITES=false/i);
    expect(raw).toMatch(/list_connections/);
    expect(raw).toMatch(/get_account_info/);
  });

  it("forbids secrets in repo", () => {
    expect(raw).toMatch(/Never commit/i);
    expect(raw).not.toMatch(/api_secret\s*=\s*["'][a-zA-Z0-9]{8,}/);
  });
});
