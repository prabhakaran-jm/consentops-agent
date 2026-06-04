import type {
  FivetranAdapter,
  FivetranConnector,
  FivetranSyncEvent,
  TriggerSyncResult,
} from "@/lib/connectors/fivetranAdapter";
import {
  getFivetranMcpRuntimeConfig,
  listFivetranConnectorsViaMcp,
  type FivetranMcpRuntimeConfig,
} from "@/lib/connectors/fivetranMcpRuntime";
import { ReadOnlyFivetranError, RealFivetranAdapter } from "@/lib/connectors/realFivetranAdapter";

export class McpFivetranAdapter implements FivetranAdapter {
  private readonly restFallback: RealFivetranAdapter | null;

  constructor(
    private readonly mcpConfig: FivetranMcpRuntimeConfig,
    restFallback?: RealFivetranAdapter | null,
  ) {
    this.restFallback = restFallback ?? RealFivetranAdapter.fromEnv();
  }

  static fromEnv(): McpFivetranAdapter | null {
    const config = getFivetranMcpRuntimeConfig();
    return config ? new McpFivetranAdapter(config) : null;
  }

  async listConnectors(): Promise<FivetranConnector[]> {
    try {
      return await listFivetranConnectorsViaMcp(this.mcpConfig);
    } catch (error) {
      if (!this.restFallback) throw error;
      return this.restFallback.listConnectors();
    }
  }

  async getConnectorStatus(connectorId: string): Promise<FivetranConnector> {
    const connectors = await this.listConnectors();
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) {
      throw new Error(`Unknown Fivetran connection '${connectorId}'.`);
    }
    return connector;
  }

  async getRecentSyncs(connectorId: string): Promise<FivetranSyncEvent[]> {
    const connector = await this.getConnectorStatus(connectorId);
    return [
      {
        id: `sync_${connectorId}_latest`,
        connectorId,
        startedAtIso: connector.lastSyncedAtIso,
        completedAtIso: connector.lastSyncedAtIso,
        status: connector.lastSyncStatus === "failed" ? "failed" : "success",
        recordsProcessed: 0,
        message: "Latest sync summary from Fivetran MCP runtime (read-only).",
      },
    ];
  }

  async triggerSync(connectorId: string): Promise<TriggerSyncResult> {
    void connectorId;
    throw new ReadOnlyFivetranError(
      "McpFivetranAdapter is read-only; triggerSync is disabled in the ConsentOps demo.",
    );
  }
}
