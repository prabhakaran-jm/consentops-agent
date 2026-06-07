import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  discoverFivetranPipelineViaMcp,
  FIVETRAN_MCP_DISCOVERY_TOOLS,
} from "@/lib/connectors/fivetranPipelineDiscovery";

const mockInvoke = vi.fn();

vi.mock("@/lib/connectors/fivetranAgentBridge", () => ({
  invokeFivetranReadOnlyTool: (...args: unknown[]) => mockInvoke(...args),
  isEmptyFivetranToolData: (data: unknown) =>
    data == null || (typeof data === "object" && Object.keys(data as object).length === 0),
}));

const listConnectionsResult = {
  capability: "fivetran_read_only",
  tool: "list_connections",
  source: "mock",
  disclaimer: "demo",
  data: {
    data: {
      items: [
        {
          id: "brandy_indictment",
          group_id: "cashier_physically",
          service: "bigquery_db",
          schema: "bigquery_db",
          status: { setup_state: "connected", sync_state: "scheduled" },
        },
        {
          id: "motioned_drudgery",
          group_id: "cashier_physically",
          service: "fivetran_log",
          schema: "fivetran_metadata_cashier_physically",
          status: { setup_state: "connected", sync_state: "scheduled" },
        },
      ],
    },
  },
  summaryForAgent: "2 Fivetran connection(s) listed.",
};

describe("fivetranPipelineDiscovery", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation(async (tool: string) => {
      if (tool === "list_connections") return listConnectionsResult;
      if (tool === "get_account_info") {
        return {
          ...listConnectionsResult,
          tool,
          data: { account_id: "consentops-demo", connection_count: 2, read_only: true },
          summaryForAgent: "Fivetran account metadata retrieved.",
        };
      }
      if (tool === "get_connection_details") {
        return {
          ...listConnectionsResult,
          tool,
          data: listConnectionsResult.data.data.items[0],
          summaryForAgent: "Connection details for brandy_indictment.",
        };
      }
      if (tool === "get_connection_state") {
        return {
          ...listConnectionsResult,
          tool,
          data: {
            connection_id: "brandy_indictment",
            sync_state: "scheduled",
            setup_state: "connected",
          },
          summaryForAgent: "State for brandy_indictment.",
        };
      }
      if (tool === "list_destinations") {
        return {
          ...listConnectionsResult,
          tool,
          data: { items: [{ id: "cashier_physically", type: "bigquery" }] },
          summaryForAgent: "Destinations listed.",
        };
      }
      throw new Error(`unexpected tool ${tool}`);
    });
  });

  it("exports the five read-only discovery tools", () => {
    expect(FIVETRAN_MCP_DISCOVERY_TOOLS).toEqual([
      "get_account_info",
      "list_connections",
      "get_connection_details",
      "get_connection_state",
      "list_destinations",
    ]);
  });

  it("runs discovery tools and builds lineage from list_connections", async () => {
    const result = await discoverFivetranPipelineViaMcp();

    expect(result.toolsRun).toBe(5);
    expect(result.mcpTrace.map((step) => step.tool)).toEqual([
      "get_account_info",
      "list_connections",
      "get_connection_details",
      "get_connection_state",
      "list_destinations",
    ]);
    expect(result.mcpTrace.every((step) => step.ok)).toBe(true);
    expect(result.pipelineLineage).toHaveLength(2);
    expect(result.pipelineLineage[0]?.connectorAlias).toBe("connector_01");
    expect(result.pipelineLineage[0]?.mappedTables.length).toBeGreaterThan(0);
    expect(result.discoverySource).toBe("mock");
  });

  it("marks skipped detail/state steps when no connections exist", async () => {
    mockInvoke.mockImplementation(async (tool: string) => {
      if (tool === "list_connections") {
        return {
          ...listConnectionsResult,
          data: { data: { items: [] } },
          summaryForAgent: "0 Fivetran connection(s) listed.",
        };
      }
      return {
        ...listConnectionsResult,
        tool,
        data: {},
        summaryForAgent: `${tool} completed`,
      };
    });

    const result = await discoverFivetranPipelineViaMcp();

    expect(result.pipelineLineage).toEqual([]);
    expect(result.mcpTrace.find((step) => step.tool === "get_connection_details")?.ok).toBe(false);
    expect(result.mcpTrace.find((step) => step.tool === "get_connection_state")?.ok).toBe(false);
  });
});
