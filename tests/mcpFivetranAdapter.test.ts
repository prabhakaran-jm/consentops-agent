import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFivetranAdapter,
  getFivetranIntegrationSource,
  getFivetranPanelMode,
} from "@/lib/connectors/fivetranAdapterFactory";
import { McpFivetranAdapter } from "@/lib/connectors/mcpFivetranAdapter";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import { isFivetranMcpRuntimeEnabled } from "@/lib/connectors/fivetranMcpRuntime";
import { RealFivetranAdapter } from "@/lib/connectors/realFivetranAdapter";

vi.mock("@/lib/connectors/fivetranMcpRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectors/fivetranMcpRuntime")>();
  return {
    ...actual,
    listFivetranConnectorsViaMcp: vi.fn(),
  };
});

import { listFivetranConnectorsViaMcp } from "@/lib/connectors/fivetranMcpRuntime";

describe("Fivetran MCP runtime", () => {
  const savedEnv = {
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
    FIVETRAN_MCP_RUNTIME: process.env.FIVETRAN_MCP_RUNTIME,
    FIVETRAN_ALLOW_WRITES: process.env.FIVETRAN_ALLOW_WRITES,
  };

  beforeEach(() => {
    vi.mocked(listFivetranConnectorsViaMcp).mockReset();
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
    delete process.env.FIVETRAN_MCP_RUNTIME;
    delete process.env.FIVETRAN_ALLOW_WRITES;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it("enables MCP runtime only when flag, credentials, and writes disabled", () => {
    expect(isFivetranMcpRuntimeEnabled()).toBe(false);

    process.env.FIVETRAN_MCP_RUNTIME = "true";
    expect(isFivetranMcpRuntimeEnabled()).toBe(false);

    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";
    expect(isFivetranMcpRuntimeEnabled()).toBe(true);

    process.env.FIVETRAN_ALLOW_WRITES = "true";
    expect(isFivetranMcpRuntimeEnabled()).toBe(false);
  });

  it("selects McpFivetranAdapter when MCP runtime is enabled", () => {
    process.env.FIVETRAN_MCP_RUNTIME = "true";
    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";

    vi.mocked(listFivetranConnectorsViaMcp).mockResolvedValue([
      {
        id: "conn_mcp_1",
        name: "bigquery → bigquery_db",
        description: "MCP",
        source: "bigquery",
        destination: "bigquery_db",
        health: "healthy",
        lastSyncedAtIso: new Date().toISOString(),
        lastSyncStatus: "success",
        mappedTables: [],
      },
    ]);

    expect(getFivetranIntegrationSource()).toBe("mcp_runtime");
    expect(getFivetranPanelMode()).toBe("mcp_runtime");
    expect(getFivetranAdapter()).toBeInstanceOf(McpFivetranAdapter);
  });

  it("falls back to REST when MCP list fails", async () => {
    process.env.FIVETRAN_MCP_RUNTIME = "true";
    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";

    vi.mocked(listFivetranConnectorsViaMcp).mockRejectedValue(new Error("uvx not found"));

    const mockGet = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "conn_rest_1",
            service: "bigquery",
            schema: "bigquery_db",
            succeeded_at: new Date().toISOString(),
          },
        ],
      },
    });
    const client = { get: mockGet };
    const adapter = new McpFivetranAdapter(
      {
        apiKey: "plant-key",
        apiSecret: "plant-secret",
        command: "uvx",
        args: ["fivetran-mcp"],
      },
      new RealFivetranAdapter({ apiKey: "plant-key", apiSecret: "plant-secret" }, client),
    );

    const connectors = await adapter.listConnectors();
    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.source).toBe("bigquery");
    expect(mockGet).toHaveBeenCalled();
  });

  it("uses mock when credentials are missing", () => {
    expect(getFivetranAdapter()).toBeInstanceOf(MockFivetranAdapter);
  });
});
