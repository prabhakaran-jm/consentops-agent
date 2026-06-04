import type {
  FivetranAdapter,
  FivetranConnector,
  FivetranSyncEvent,
  TriggerSyncResult,
} from "@/lib/connectors/fivetranAdapter";
import {
  createFivetranHttpClient,
  mapFivetranConnectionItem,
  parseFivetranConnectionItems,
  type FivetranHttpClient,
  type FivetranListConnectionsResponse,
} from "@/lib/connectors/fivetranRestClient";

export interface RealFivetranConfig {
  apiKey: string;
  apiSecret: string;
}

export class ReadOnlyFivetranError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyFivetranError";
  }
}

export const getRealFivetranConfigFromEnv = (): RealFivetranConfig | null => {
  const apiKey = process.env.FIVETRAN_API_KEY?.trim();
  const apiSecret = process.env.FIVETRAN_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
};

export class RealFivetranAdapter implements FivetranAdapter {
  private readonly client: FivetranHttpClient;

  constructor(
    private readonly config: RealFivetranConfig,
    client?: FivetranHttpClient,
  ) {
    this.client = client ?? createFivetranHttpClient(config.apiKey, config.apiSecret);
  }

  static fromEnv(client?: FivetranHttpClient): RealFivetranAdapter | null {
    const config = getRealFivetranConfigFromEnv();
    return config ? new RealFivetranAdapter(config, client) : null;
  }

  private assertConfigured(): void {
    if (!this.config.apiKey.trim() || !this.config.apiSecret.trim()) {
      throw new Error("Real Fivetran adapter requires FIVETRAN_API_KEY and FIVETRAN_API_SECRET.");
    }
  }

  private async listConnectionItems(): Promise<ReturnType<typeof parseFivetranConnectionItems>> {
    const payload = (await this.client.get("/connections?limit=100")) as FivetranListConnectionsResponse;
    const items = parseFivetranConnectionItems(payload);
    if (items.length > 0) return items;

    const legacy = (await this.client.get("/connectors?limit=100")) as FivetranListConnectionsResponse;
    return parseFivetranConnectionItems(legacy);
  }

  async listConnectors(): Promise<FivetranConnector[]> {
    this.assertConfigured();
    const items = await this.listConnectionItems();
    return items.map((item) =>
      mapFivetranConnectionItem(
        item,
        "Live read-only status from Fivetran REST API. No sync or cleanup performed.",
      ),
    );
  }

  async getConnectorStatus(connectorId: string): Promise<FivetranConnector> {
    this.assertConfigured();
    const connectors = await this.listConnectors();
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) {
      throw new Error(`Unknown Fivetran connection '${connectorId}'.`);
    }
    return connector;
  }

  async getRecentSyncs(connectorId: string): Promise<FivetranSyncEvent[]> {
    this.assertConfigured();
    const connector = await this.getConnectorStatus(connectorId);

    return [
      {
        id: `sync_${connectorId}_latest`,
        connectorId,
        startedAtIso: connector.lastSyncedAtIso,
        completedAtIso: connector.lastSyncedAtIso,
        status: connector.lastSyncStatus === "failed" ? "failed" : "success",
        recordsProcessed: 0,
        message: "Latest sync summary from Fivetran connection metadata (read-only).",
      },
    ];
  }

  async triggerSync(connectorId: string): Promise<TriggerSyncResult> {
    void connectorId;
    this.assertConfigured();
    throw new ReadOnlyFivetranError(
      "RealFivetranAdapter is read-only; triggerSync is disabled in the ConsentOps demo.",
    );
  }
}
