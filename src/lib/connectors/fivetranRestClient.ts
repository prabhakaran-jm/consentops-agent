import type { FivetranConnector, FivetranConnectorHealth } from "@/lib/connectors/fivetranAdapter";
import type { WarehouseTableName } from "@/lib/warehouse/types";

export const FIVETRAN_API_BASE = "https://api.fivetran.com/v1";

export type FivetranConnectionApiItem = {
  id: string;
  service?: string;
  schema?: string;
  paused?: boolean;
  succeeded_at?: string | null;
  failed_at?: string | null;
  created_at?: string | null;
  status?: {
    setup_state?: string;
    sync_state?: string;
    warnings?: unknown[];
  };
};

export type FivetranListConnectionsResponse = {
  code?: string;
  data?: {
    items?: FivetranConnectionApiItem[];
    next_cursor?: string | null;
  };
};

const SERVICE_TABLE_HINTS: Record<string, WarehouseTableName[]> = {
  google_sheets: ["crm_customers"],
  stripe: ["payments_transactions", "commerce_orders"],
  zendesk: ["support_tickets"],
  segment: ["marketing_email_events", "analytics_customer_360", "ai_training_feedback_export"],
  shopify: ["commerce_orders"],
  salesforce: ["crm_customers"],
};

export const inferMappedTables = (service: string | undefined): WarehouseTableName[] => {
  if (!service) return [];
  return SERVICE_TABLE_HINTS[service.toLowerCase()] ?? [];
};

export const inferConnectorHealth = (item: FivetranConnectionApiItem): FivetranConnectorHealth => {
  if (item.paused) return "offline";

  const setupState = item.status?.setup_state?.toLowerCase();
  if (setupState && setupState !== "connected") return "warning";

  const syncState = item.status?.sync_state?.toLowerCase();
  if (syncState === "paused" || syncState === "broken") return "offline";

  const warnings = item.status?.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) return "warning";

  if (item.failed_at && (!item.succeeded_at || item.failed_at > item.succeeded_at)) {
    return "warning";
  }

  return "healthy";
};

const connectionLabel = (item: FivetranConnectionApiItem): string => {
  const service = item.service ?? "connector";
  const schema = item.schema ?? "destination";
  return `${service} → ${schema}`;
};

export const mapFivetranConnectionItem = (
  item: FivetranConnectionApiItem,
  description = "Live read-only status from Fivetran. No sync or cleanup performed.",
): FivetranConnector => {
  const service = item.service ?? "unknown";
  const lastSyncedAtIso =
    item.succeeded_at ?? item.failed_at ?? item.created_at ?? new Date(0).toISOString();

  return {
    id: item.id,
    name: connectionLabel(item),
    description,
    source: service,
    destination: item.schema ?? "warehouse",
    health: inferConnectorHealth(item),
    lastSyncedAtIso,
    lastSyncStatus: inferLastSyncStatus(item),
    mappedTables: inferMappedTables(service),
  };
};

export const parseFivetranConnectionItems = (payload: unknown): FivetranConnectionApiItem[] => {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as FivetranListConnectionsResponse).data;
  return data?.items ?? [];
};

export const inferLastSyncStatus = (item: FivetranConnectionApiItem): "success" | "failed" => {
  if (item.failed_at && (!item.succeeded_at || item.failed_at > item.succeeded_at)) {
    return "failed";
  }
  return "success";
};

export const buildBasicAuthHeader = (apiKey: string, apiSecret: string): string => {
  const token = Buffer.from(`${apiKey}:${apiSecret}`, "utf8").toString("base64");
  return `Basic ${token}`;
};

export const redactFivetranSecrets = (message: string, apiKey: string, apiSecret: string): string =>
  message.split(apiKey).join("[REDACTED]").split(apiSecret).join("[REDACTED]");

export type FivetranHttpClient = {
  get(path: string): Promise<unknown>;
};

export const createFivetranHttpClient = (apiKey: string, apiSecret: string): FivetranHttpClient => ({
  async get(path: string) {
    const response = await fetch(`${FIVETRAN_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: buildBasicAuthHeader(apiKey, apiSecret),
        Accept: "application/json",
      },
    });

    const bodyText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      parsed = bodyText;
    }

    if (!response.ok) {
      const detail =
        typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : bodyText.slice(0, 200);
      throw new Error(
        redactFivetranSecrets(
          `Fivetran API ${response.status} on ${path}: ${detail}`,
          apiKey,
          apiSecret,
        ),
      );
    }

    return parsed;
  },
});
