import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const evidencePath = resolve(process.cwd(), "docs/fivetran-mcp-evidence.md");

describe("fivetran MCP evidence doc", () => {
  const raw = readFileSync(evidencePath, "utf8");

  it("includes read-only banner and template status", () => {
    expect(raw).toMatch(/Read-only MCP evidence/i);
    expect(raw).toMatch(/No sync, write, or cleanup was performed via Fivetran MCP/i);
    expect(raw).toMatch(/Evidence status.*TEMPLATE/i);
  });

  it("uses sanitized aliases only in the placeholder table", () => {
    expect(raw).toContain("connector_A");
    expect(raw).toContain("destination_1");
    expect(raw).not.toMatch(/conn_google_sheets_crm/);
    expect(raw).not.toMatch(/conn_zendesk_mock/);
  });

  it("includes redaction checklist and forbids secrets in repo", () => {
    expect(raw).toMatch(/Redaction checklist/i);
    expect(raw).toMatch(/Never commit:/i);
    expect(raw).toMatch(/FIVETRAN_API_KEY/);
    expect(raw).not.toMatch(/api_secret\s*=\s*["'][a-zA-Z0-9]{8,}/);
  });
});
