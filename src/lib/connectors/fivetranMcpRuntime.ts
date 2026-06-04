import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import {
  mapFivetranConnectionItem,
  parseFivetranConnectionItems,
  redactFivetranSecrets,
} from "@/lib/connectors/fivetranRestClient";
import { getRealFivetranConfigFromEnv, type RealFivetranConfig } from "@/lib/connectors/realFivetranAdapter";

const LIST_CONNECTIONS_SCHEMA = "open-api-definitions/connections/list_connections.json";
const MCP_TIMEOUT_MS = 45_000;

const READ_ONLY_TOOL_NAMES = new Set([
  "get_account_info",
  "list_connections",
  "get_connection_details",
  "get_connection_state",
  "list_destinations",
]);

export type FivetranMcpRuntimeConfig = RealFivetranConfig & {
  command: string;
  args: string[];
};

const envFlagEnabled = (name: string): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
};

export const isFivetranMcpRuntimeEnabled = (): boolean => {
  if (!envFlagEnabled("FIVETRAN_MCP_RUNTIME")) return false;
  if (!getRealFivetranConfigFromEnv()) return false;
  const allowWrites = process.env.FIVETRAN_ALLOW_WRITES?.trim().toLowerCase();
  if (allowWrites === "true" || allowWrites === "1" || allowWrites === "yes") {
    return false;
  }
  return true;
};

export const getFivetranMcpRuntimeConfig = (): FivetranMcpRuntimeConfig | null => {
  const base = getRealFivetranConfigFromEnv();
  if (!base || !isFivetranMcpRuntimeEnabled()) return null;

  const command = process.env.FIVETRAN_MCP_COMMAND?.trim() || "uvx";
  const argsFromEnv = process.env.FIVETRAN_MCP_ARGS?.trim();
  const args = argsFromEnv
    ? argsFromEnv.split(/\s+/).filter(Boolean)
    : ["--from", "git+https://github.com/fivetran/fivetran-mcp", "fivetran-mcp"];

  return { ...base, command, args };
};

const parseToolJsonPayload = (result: unknown): unknown => {
  if (!result || typeof result !== "object") return null;
  const blocks = (result as { content?: unknown }).content;
  if (!Array.isArray(blocks)) return null;

  for (const block of blocks) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
    ) {
      try {
        return JSON.parse(block.text) as unknown;
      } catch {
        continue;
      }
    }
  }
  return null;
};

const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Fivetran MCP ${label} timed out after ${MCP_TIMEOUT_MS}ms`)), MCP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export type FivetranMcpSession = {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
};

export const openFivetranMcpSession = async (
  config: FivetranMcpRuntimeConfig,
): Promise<FivetranMcpSession> => {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: {
      FIVETRAN_API_KEY: config.apiKey,
      FIVETRAN_API_SECRET: config.apiSecret,
      FIVETRAN_ALLOW_WRITES: "false",
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "consentops-agent", version: "0.1.0" });
  await withTimeout(
    (async () => {
      await client.connect(transport);
    })(),
    "connect",
  );

  return {
    async callTool(name: string, args: Record<string, unknown>) {
      if (!READ_ONLY_TOOL_NAMES.has(name)) {
        throw new Error(`Fivetran MCP tool '${name}' is not allowlisted for read-only runtime.`);
      }
      const result = await withTimeout(
        client.callTool({ name, arguments: args }),
        `tool:${name}`,
      );
      return parseToolJsonPayload(result);
    },
    async close() {
      await client.close();
    },
  };
};

export const listFivetranConnectorsViaMcp = async (
  config: FivetranMcpRuntimeConfig,
): Promise<FivetranConnector[]> => {
  const session = await openFivetranMcpSession(config);
  try {
    const payload = await session.callTool("list_connections", {
      schema_file: LIST_CONNECTIONS_SCHEMA,
    });
    const items = parseFivetranConnectionItems(payload);
    return items.map((item) =>
      mapFivetranConnectionItem(
        item,
        "Live read-only status from Fivetran MCP (runtime). No sync or cleanup performed.",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fivetran MCP list_connections failed";
    throw new Error(redactFivetranSecrets(message, config.apiKey, config.apiSecret));
  } finally {
    await session.close();
  }
};
