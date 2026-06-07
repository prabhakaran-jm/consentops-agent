import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import { getFivetranAdapter, getFivetranIntegrationSource } from "@/lib/connectors/fivetranAdapterFactory";
import {
  type FivetranConnectionApiItem,
  parseFivetranConnectionItems,
} from "@/lib/connectors/fivetranRestClient";
import {
  buildFivetranAliasMap,
  connectionItemsFromListPayload,
} from "@/lib/connectors/fivetranPublicSanitizer";
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
  enrichedFrom?: "list_connections";
};

const READ_ONLY_DISCLAIMER =
  "Read-only Fivetran lookup via ConsentOps Cloud Run. No sync triggers, writes, or cleanup.";

const ENRICHABLE_TOOLS = new Set([
  "get_account_info",
  "get_connection_details",
  "get_connection_state",
  "list_destinations",
]);

type ConnectionItem = FivetranConnectionApiItem & {
  group_id?: string;
  connected_by?: string;
};

const connectionIdFromArgs = (args: Record<string, unknown>): string => {
  const raw = args.connection_id ?? args.id ?? args.connector_id;
  return typeof raw === "string" ? raw.trim() : "";
};

export const isEmptyFivetranToolData = (data: unknown): boolean => {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    return Object.keys(data as Record<string, unknown>).length === 0;
  }
  return false;
};

const connectionItemsFromPayload = (payload: unknown): ConnectionItem[] =>
  connectionItemsFromListPayload(payload);

const inferDestinationType = (service: string | undefined): string => {
  if (!service) return "warehouse";
  if (service.includes("bigquery")) return "bigquery";
  if (service === "fivetran_log") return "fivetran_metadata";
  return service;
};

export const enrichFivetranToolFromListConnections = (
  tool: string,
  args: Record<string, unknown>,
  listPayload: unknown,
): unknown => {
  const items = connectionItemsFromPayload(listPayload);
  if (items.length === 0) {
    return { note: "No connections returned from list_connections." };
  }

  switch (tool) {
    case "get_account_info": {
      const destinationGroups = [
        ...new Set(items.map((entry) => entry.group_id).filter(Boolean)),
      ] as string[];
      const services = [...new Set(items.map((entry) => entry.service).filter(Boolean))] as string[];
      const connectedBy = items.find((entry) => entry.connected_by)?.connected_by;
      return {
        account_id: destinationGroups[0] ?? "fivetran-demo-account",
        connection_count: items.length,
        destination_groups: destinationGroups,
        services,
        connected_by: connectedBy ?? null,
        read_only: true,
        enrichedFrom: "list_connections",
      };
    }
    case "get_connection_details": {
      const connectionId = connectionIdFromArgs(args);
      if (!connectionId) {
        throw new Error("get_connection_details requires connection_id.");
      }
      const item = items.find((entry) => entry.id === connectionId);
      if (!item) {
        throw new Error(`Unknown Fivetran connection '${connectionId}'.`);
      }
      return {
        ...item,
        enrichedFrom: "list_connections",
      };
    }
    case "get_connection_state": {
      const connectionId = connectionIdFromArgs(args);
      if (!connectionId) {
        throw new Error("get_connection_state requires connection_id.");
      }
      const item = items.find((entry) => entry.id === connectionId);
      if (!item) {
        throw new Error(`Unknown Fivetran connection '${connectionId}'.`);
      }
      return {
        connection_id: connectionId,
        service: item.service,
        schema: item.schema,
        setup_state: item.status?.setup_state ?? "unknown",
        sync_state: item.status?.sync_state ?? "unknown",
        succeeded_at: item.succeeded_at,
        failed_at: item.failed_at,
        paused: item.paused ?? false,
        enrichedFrom: "list_connections",
      };
    }
    case "list_destinations": {
      const byGroup = new Map<string, ConnectionItem[]>();
      for (const item of items) {
        const groupId = item.group_id ?? item.schema ?? item.id;
        const bucket = byGroup.get(groupId) ?? [];
        bucket.push(item);
        byGroup.set(groupId, bucket);
      }
      return {
        items: [...byGroup.entries()].map(([groupId, groupItems]) => ({
          id: groupId,
          type: inferDestinationType(groupItems[0]?.service),
          connections: groupItems.map((entry) => ({
            id: entry.id,
            service: entry.service,
            schema: entry.schema,
            sync_state: entry.status?.sync_state,
            succeeded_at: entry.succeeded_at,
          })),
        })),
        enrichedFrom: "list_connections",
      };
    }
    default:
      return listPayload;
  }
};

const buildSummaryForAgent = (tool: string, data: unknown, enriched: boolean): string => {
  if (tool === "get_account_info" && data && typeof data === "object") {
    const account = data as Record<string, unknown>;
    const groups = Array.isArray(account.destination_groups)
      ? (account.destination_groups as string[]).join(", ")
      : "unknown";
    const count = account.connection_count ?? "?";
    return enriched
      ? `Fivetran account active (read-only): ${count} connection(s), destination group(s) ${groups}.`
      : "Fivetran account metadata retrieved.";
  }
  if (tool === "get_connection_details" && data && typeof data === "object") {
    const item = data as ConnectionItem;
    return enriched
      ? `Connection ${item.id} (${item.service} → schema ${item.schema}): setup ${item.status?.setup_state}, sync ${item.status?.sync_state}, last success ${item.succeeded_at ?? "n/a"}.`
      : `Connection details for ${item.id ?? "connector"}.`;
  }
  if (tool === "get_connection_state" && data && typeof data === "object") {
    const state = data as Record<string, unknown>;
    return enriched
      ? `State for ${state.connection_id}: sync ${state.sync_state}, setup ${state.setup_state}, last success ${state.succeeded_at ?? "n/a"}.`
      : `Connection state for ${state.connection_id ?? "connector"}.`;
  }
  if (tool === "list_destinations" && data && typeof data === "object") {
    const payload = data as { items?: Array<{ id: string; type: string }> };
    const labels = (payload.items ?? []).map((item) => `${item.id} (${item.type})`).join(", ");
    return enriched
      ? `Destinations/groups: ${labels || "none"}.`
      : "Destinations listed.";
  }
  if (tool === "list_connections" && data && typeof data === "object") {
    const count = connectionItemsFromPayload(data).length;
    return `${count} Fivetran connection(s) listed.`;
  }
  return `Fivetran MCP tool ${tool} completed via Cloud Run runtime.`;
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

const aliasMapFromAdapter = async () => {
  const connectors = await getFivetranAdapter().listConnectors();
  return buildFivetranAliasMap(connectors.map(connectorToConnectionItem));
};

export const getFivetranPublicAliasMap = async (): Promise<ReturnType<typeof buildFivetranAliasMap>> =>
  aliasMapFromAdapter();

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
          account_id: "consentops-demo",
          connection_count: (await adapter.listConnectors()).length,
          read_only: true,
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

const loadListConnectionsPayload = async (
  session: Awaited<ReturnType<typeof openFivetranMcpSession>>,
): Promise<unknown> =>
  session.callTool("list_connections", { schema_file: LIST_CONNECTIONS_SCHEMA });

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
      let data = await session.callTool(tool, normalizedArgs);
      let enrichedFrom: "list_connections" | undefined;

      if (ENRICHABLE_TOOLS.has(tool) && isEmptyFivetranToolData(data)) {
        const listPayload = await loadListConnectionsPayload(session);
        data = enrichFivetranToolFromListConnections(tool, normalizedArgs, listPayload);
        enrichedFrom = "list_connections";
      }

      return {
        capability: "fivetran_read_only",
        tool,
        source: "mcp_runtime",
        disclaimer: READ_ONLY_DISCLAIMER,
        data,
        enrichedFrom,
        summaryForAgent: buildSummaryForAgent(tool, data, enrichedFrom === "list_connections"),
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
    summaryForAgent: buildSummaryForAgent(tool, data, false),
  };
};
