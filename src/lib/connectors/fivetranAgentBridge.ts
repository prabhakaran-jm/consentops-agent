import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import { getFivetranAdapter, getFivetranIntegrationSource } from "@/lib/connectors/fivetranAdapterFactory";
import {
  getFivetranMcpRuntimeConfig,
  LIST_CONNECTIONS_SCHEMA,
  openFivetranMcpSession,
  READ_ONLY_FIVETRAN_TOOL_NAMES,
} from "@/lib/connectors/fivetranMcpRuntime";

export type FivetranAgentToolSource = "mcp_runtime" | "rest" | "mock";

export type FivetranAgentToolResult = {
  capability: "fivetran_read_only";
  tool: string;
  source: FivetranAgentToolSource;
  disclaimer: string;
  data: unknown;
  summaryForAgent?: string;
};

const READ_ONLY_DISCLAIMER =
  "Read-only Fivetran lookup via ConsentOps Cloud Run. No sync triggers, writes, or cleanup.";

const connectionIdFromArgs = (args: Record<string, unknown>): string => {
  const raw = args.connection_id ?? args.id ?? args.connector_id;
  return typeof raw === "string" ? raw.trim() : "";
};

const connectorToConnectionItem = (connector: FivetranConnector) => ({
  id: connector.id,
  service: connector.source,
  schema: connector.name,
  paused: connector.health === "offline",
  succeeded_at: connector.lastSyncStatus === "success" ? connector.lastSyncedAtIso : null,
  failed_at: connector.lastSyncStatus === "failed" ? connector.lastSyncedAtIso : null,
  status: {
    setup_state: connector.health === "healthy" ? "connected" : "incomplete",
    sync_state: connector.health === "offline" ? "paused" : "scheduled",
  },
  mappedTables: connector.mappedTables,
  destination: connector.destination,
  health: connector.health,
  description: connector.description,
});

const fallbackViaAdapter = async (
  tool: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; source: FivetranAgentToolSource }> => {
  const adapter = getFivetranAdapter();
  const source: FivetranAgentToolSource =
    getFivetranIntegrationSource() === "mock" ? "mock" : "rest";

  switch (tool) {
    case "get_account_info":
      return {
        source,
        data: {
          account: "consentops-demo",
          readOnly: true,
          note: "Account metadata via ConsentOps adapter fallback (MCP runtime unavailable).",
        },
      };
    case "list_connections": {
      const connectors = await adapter.listConnectors();
      return {
        source,
        data: {
          data: {
            items: connectors.map(connectorToConnectionItem),
          },
        },
      };
    }
    case "get_connection_details": {
      const connectionId = connectionIdFromArgs(args);
      if (!connectionId) {
        throw new Error("get_connection_details requires connection_id.");
      }
      const connector = await adapter.getConnectorStatus(connectionId);
      return { source, data: connectorToConnectionItem(connector) };
    }
    case "get_connection_state": {
      const connectionId = connectionIdFromArgs(args);
      if (!connectionId) {
        throw new Error("get_connection_state requires connection_id.");
      }
      const connector = await adapter.getConnectorStatus(connectionId);
      return {
        source,
        data: {
          connection_id: connectionId,
          sync_state: connector.health === "offline" ? "paused" : "scheduled",
          last_sync_status: connector.lastSyncStatus,
          last_synced_at: connector.lastSyncedAtIso,
          note: "State summary via ConsentOps adapter fallback (not live MCP poll).",
        },
      };
    }
    case "list_destinations": {
      const connectors = await adapter.listConnectors();
      const destinations = [...new Set(connectors.map((connector) => connector.destination))];
      return {
        source,
        data: {
          items: destinations.map((destination) => ({
            id: destination,
            service: destination,
            type: destination.includes("bigquery") ? "bigquery" : destination,
          })),
        },
      };
    }
    default:
      throw new Error(`Unsupported Fivetran tool '${tool}'.`);
  }
};

const normalizeToolArgs = (tool: string, args: Record<string, unknown>): Record<string, unknown> => {
  if (tool === "list_connections" && !args.schema_file) {
    return { ...args, schema_file: LIST_CONNECTIONS_SCHEMA };
  }
  return args;
};

export const invokeFivetranReadOnlyTool = async (
  tool: string,
  args: Record<string, unknown> = {},
): Promise<FivetranAgentToolResult> => {
  if (!READ_ONLY_FIVETRAN_TOOL_NAMES.has(tool)) {
    throw new Error(
      `Fivetran tool '${tool}' is not allowlisted. Allowed: ${[...READ_ONLY_FIVETRAN_TOOL_NAMES].join(", ")}.`,
    );
  }

  const normalizedArgs = normalizeToolArgs(tool, args);
  const mcpConfig = getFivetranMcpRuntimeConfig();

  if (mcpConfig) {
    const session = await openFivetranMcpSession(mcpConfig);
    try {
      const data = await session.callTool(tool, normalizedArgs);
      return {
        capability: "fivetran_read_only",
        tool,
        source: "mcp_runtime",
        disclaimer: READ_ONLY_DISCLAIMER,
        data,
        summaryForAgent: `Fivetran MCP tool ${tool} completed via Cloud Run runtime.`,
      };
    } finally {
      await session.close();
    }
  }

  const { data, source } = await fallbackViaAdapter(tool, normalizedArgs);
  return {
    capability: "fivetran_read_only",
    tool,
    source,
    disclaimer: READ_ONLY_DISCLAIMER,
    data,
    summaryForAgent: `Fivetran ${tool} via ${source} fallback on Cloud Run.`,
  };
};
