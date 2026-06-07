import {
  type FivetranAgentToolSource,
  invokeFivetranReadOnlyTool,
  isEmptyFivetranToolData,
} from "@/lib/connectors/fivetranAgentBridge";
import { READ_ONLY_FIVETRAN_TOOL_NAMES } from "@/lib/connectors/fivetranMcpRuntime";
import {
  inferMappedTables,
  parseFivetranConnectionItems,
  type FivetranConnectionApiItem,
} from "@/lib/connectors/fivetranRestClient";
import type { WarehouseTableName } from "@/lib/warehouse/types";

export const FIVETRAN_MCP_DISCOVERY_TOOLS = [...READ_ONLY_FIVETRAN_TOOL_NAMES];

export type FivetranMcpTraceStep = {
  tool: string;
  ok: boolean;
  summary: string;
  enrichedFrom?: "list_connections";
};

export type PipelineLineageEntry = {
  connectorAlias: string;
  service: string;
  schema: string;
  health: "healthy" | "warning" | "offline";
  mappedTables: WarehouseTableName[];
};

export type FivetranPipelineDiscovery = {
  mcpTrace: FivetranMcpTraceStep[];
  pipelineLineage: PipelineLineageEntry[];
  discoverySource: FivetranAgentToolSource;
  toolsRun: number;
};

type ConnectionItem = FivetranConnectionApiItem & { group_id?: string };

const connectionItemsFromPayload = (payload: unknown): ConnectionItem[] =>
  parseFivetranConnectionItems(payload) as ConnectionItem[];

const inferHealth = (item: ConnectionItem): PipelineLineageEntry["health"] => {
  if (item.paused) return "offline";
  const setup = item.status?.setup_state?.toLowerCase();
  if (setup && setup !== "connected") return "warning";
  return "healthy";
};

const buildLineage = (items: ConnectionItem[]): PipelineLineageEntry[] =>
  items.map((item, index) => ({
    connectorAlias: `connector_${String(index + 1).padStart(2, "0")}`,
    service: item.service ?? "unknown",
    schema: item.schema ?? item.id,
    health: inferHealth(item),
    mappedTables: inferMappedTables(item.service),
  }));

export const discoverFivetranPipelineViaMcp = async (): Promise<FivetranPipelineDiscovery> => {
  const mcpTrace: FivetranMcpTraceStep[] = [];
  let listPayload: unknown = null;
  let discoverySource: FivetranAgentToolSource = "mock";

  const stepOk = (
    tool: string,
    result: Awaited<ReturnType<typeof invokeFivetranReadOnlyTool>>,
  ): boolean => {
    if (result.enrichedFrom === "list_connections") return true;
    if (tool === "list_connections") {
      return connectionItemsFromPayload(result.data).length > 0;
    }
    return !isEmptyFivetranToolData(result.data);
  };

  const recordStep = (
    tool: string,
    result: Awaited<ReturnType<typeof invokeFivetranReadOnlyTool>>,
  ) => {
    discoverySource = result.source;
    if (tool === "list_connections") {
      listPayload = result.data;
    }
    mcpTrace.push({
      tool,
      ok: stepOk(tool, result),
      summary: result.summaryForAgent ?? `${tool} completed`,
      enrichedFrom: result.enrichedFrom,
    });
  };

  recordStep("get_account_info", await invokeFivetranReadOnlyTool("get_account_info"));
  recordStep("list_connections", await invokeFivetranReadOnlyTool("list_connections"));

  const items = connectionItemsFromPayload(listPayload);
  const primary =
    items.find((item) => item.service?.includes("bigquery")) ?? items[0];

  if (primary?.id) {
    recordStep(
      "get_connection_details",
      await invokeFivetranReadOnlyTool("get_connection_details", {
        connection_id: primary.id,
      }),
    );
    recordStep(
      "get_connection_state",
      await invokeFivetranReadOnlyTool("get_connection_state", {
        connection_id: primary.id,
      }),
    );
  } else {
    mcpTrace.push(
      {
        tool: "get_connection_details",
        ok: false,
        summary: "Skipped — no connections from list_connections.",
      },
      {
        tool: "get_connection_state",
        ok: false,
        summary: "Skipped — no connections from list_connections.",
      },
    );
  }

  recordStep("list_destinations", await invokeFivetranReadOnlyTool("list_destinations"));

  const pipelineLineage = items.length > 0 ? buildLineage(items) : [];

  return {
    mcpTrace,
    pipelineLineage,
    discoverySource,
    toolsRun: mcpTrace.length,
  };
};
