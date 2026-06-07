import type { FivetranConnectionApiItem } from "@/lib/connectors/fivetranRestClient";
import { parseFivetranConnectionItems } from "@/lib/connectors/fivetranRestClient";

import type { FivetranMcpTraceStep } from "./fivetranPipelineDiscovery";

export type FivetranAliasMap = {
  connectionIdToAlias: Map<string, string>;
  groupIdToAlias: Map<string, string>;
  userIdToAlias: Map<string, string>;
  schemaToAlias: Map<string, string>;
};

type ConnectionItem = FivetranConnectionApiItem & { group_id?: string; connected_by?: string };

export const buildFivetranAliasMap = (items: ConnectionItem[]): FivetranAliasMap => {
  const connectionIdToAlias = new Map<string, string>();
  const groupIdToAlias = new Map<string, string>();
  const userIdToAlias = new Map<string, string>();
  const schemaToAlias = new Map<string, string>();

  items.forEach((item, index) => {
    connectionIdToAlias.set(item.id, `connector_${String(index + 1).padStart(2, "0")}`);
    if (item.group_id && !groupIdToAlias.has(item.group_id)) {
      groupIdToAlias.set(item.group_id, `destination_${String(groupIdToAlias.size + 1).padStart(2, "0")}`);
    }
    if (item.connected_by && !userIdToAlias.has(item.connected_by)) {
      userIdToAlias.set(item.connected_by, `account_user_${String(userIdToAlias.size + 1).padStart(2, "0")}`);
    }
    if (item.schema && !schemaToAlias.has(item.schema)) {
      schemaToAlias.set(item.schema, `demo_schema_${String(schemaToAlias.size + 1).padStart(2, "0")}`);
    }
  });

  return { connectionIdToAlias, groupIdToAlias, userIdToAlias, schemaToAlias };
};

export const connectionItemsFromListPayload = (payload: unknown): ConnectionItem[] =>
  parseFivetranConnectionItems(payload) as ConnectionItem[];

const aliasValue = (raw: string | undefined, map: Map<string, string>): string | undefined => {
  if (!raw) return raw;
  return map.get(raw) ?? raw;
};

export const sanitizePublicText = (text: string, aliasMap: FivetranAliasMap): string => {
  let out = text;
  const replaceAll = (map: Map<string, string>) => {
    for (const [raw, alias] of map) {
      if (raw.length > 0) out = out.split(raw).join(alias);
    }
  };
  replaceAll(aliasMap.schemaToAlias);
  replaceAll(aliasMap.groupIdToAlias);
  replaceAll(aliasMap.userIdToAlias);
  replaceAll(aliasMap.connectionIdToAlias);
  return out;
};

const sanitizeRecord = (
  value: Record<string, unknown>,
  aliasMap: FivetranAliasMap,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...value };

  if (typeof next.id === "string") {
    next.id = aliasValue(next.id, aliasMap.connectionIdToAlias) ?? next.id;
  }
  if (typeof next.connection_id === "string") {
    next.connection_id = aliasValue(next.connection_id, aliasMap.connectionIdToAlias) ?? next.connection_id;
  }
  if (typeof next.group_id === "string") {
    next.group_id = aliasValue(next.group_id, aliasMap.groupIdToAlias) ?? next.group_id;
  }
  if (typeof next.connected_by === "string") {
    next.connected_by = aliasValue(next.connected_by, aliasMap.userIdToAlias) ?? next.connected_by;
  }
  if (typeof next.schema === "string") {
    next.schema = aliasValue(next.schema, aliasMap.schemaToAlias) ?? next.schema;
  }

  if (Array.isArray(next.destination_groups)) {
    next.destination_groups = (next.destination_groups as string[]).map(
      (group) => aliasValue(group, aliasMap.groupIdToAlias) ?? group,
    );
  }

  if (Array.isArray(next.items)) {
    next.items = (next.items as unknown[]).map((item) => sanitizeToolData(item, aliasMap));
  }

  if (Array.isArray(next.connections)) {
    next.connections = (next.connections as unknown[]).map((item) => sanitizeToolData(item, aliasMap));
  }

  if (next.data && typeof next.data === "object") {
    next.data = sanitizeToolData(next.data, aliasMap);
  }

  return next;
};

export const sanitizeToolData = (data: unknown, aliasMap: FivetranAliasMap): unknown => {
  if (data == null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((entry) => sanitizeToolData(entry, aliasMap));
  }
  return sanitizeRecord(data as Record<string, unknown>, aliasMap);
};

export const sanitizeMcpTrace = (
  trace: FivetranMcpTraceStep[],
  aliasMap: FivetranAliasMap,
): FivetranMcpTraceStep[] =>
  trace.map((step) => ({
    ...step,
    summary: sanitizePublicText(step.summary, aliasMap),
  }));

export const sanitizeSummaryForAgent = (
  summary: string | undefined,
  aliasMap: FivetranAliasMap,
): string | undefined => (summary ? sanitizePublicText(summary, aliasMap) : summary);

export type SanitizableFivetranAgentToolResult = {
  data: unknown;
  summaryForAgent?: string;
};

export const sanitizeFivetranAgentToolResult = <T extends SanitizableFivetranAgentToolResult>(
  result: T,
  aliasMap: FivetranAliasMap,
): T => ({
  ...result,
  data: sanitizeToolData(result.data, aliasMap),
  summaryForAgent: sanitizeSummaryForAgent(result.summaryForAgent, aliasMap),
});

export const resolveRawConnectionId = (
  connectionId: string,
  aliasMap: FivetranAliasMap,
): string => {
  for (const [raw, alias] of aliasMap.connectionIdToAlias) {
    if (alias === connectionId) return raw;
  }
  return connectionId;
};

export const resolveSanitizedToolArguments = (
  tool: string,
  args: Record<string, unknown>,
  aliasMap: FivetranAliasMap,
): Record<string, unknown> => {
  if (tool !== "get_connection_details" && tool !== "get_connection_state") {
    return args;
  }
  const connectionId = args.connection_id ?? args.id ?? args.connector_id;
  if (typeof connectionId !== "string") {
    return args;
  }
  const rawId = resolveRawConnectionId(connectionId, aliasMap);
  if (args.connection_id !== undefined) {
    return { ...args, connection_id: rawId };
  }
  if (args.id !== undefined) {
    return { ...args, id: rawId };
  }
  if (args.connector_id !== undefined) {
    return { ...args, connector_id: rawId };
  }
  return args;
};
