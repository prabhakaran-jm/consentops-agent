import type {
  FivetranAdapter,
  FivetranConnector,
  FivetranSyncEvent,
  TriggerSyncResult,
} from "@/lib/connectors/fivetranAdapter";

export interface RealFivetranConfig {
  apiKey: string;
  apiSecret: string;
}

export const getRealFivetranConfigFromEnv = (): RealFivetranConfig | null => {
  const apiKey = process.env.FIVETRAN_API_KEY?.trim();
  const apiSecret = process.env.FIVETRAN_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
};

const notImplemented = (method: string): never => {
  throw new Error(
    `RealFivetranAdapter.${method} is a production placeholder and is not implemented yet.`,
  );
};

/**
 * Production Fivetran adapter placeholder.
 *
 * TODO: Authenticate with Fivetran REST API using HTTP Basic auth (apiKey:apiSecret).
 * TODO: Map Fivetran connector payloads to {@link FivetranConnector}.
 * TODO: Wire into a factory that selects MockFivetranAdapter when credentials are absent.
 * TODO: Never trigger destructive warehouse operations from this adapter — sync only.
 */
export class RealFivetranAdapter implements FivetranAdapter {
  constructor(private readonly config: RealFivetranConfig) {}

  static fromEnv(): RealFivetranAdapter | null {
    const config = getRealFivetranConfigFromEnv();
    return config ? new RealFivetranAdapter(config) : null;
  }

  private assertConfigured(): void {
    if (!this.config.apiKey.trim() || !this.config.apiSecret.trim()) {
      throw new Error(
        "Real Fivetran adapter requires FIVETRAN_API_KEY and FIVETRAN_API_SECRET.",
      );
    }
  }

  async listConnectors(): Promise<FivetranConnector[]> {
    this.assertConfigured();
    // TODO: GET https://api.fivetran.com/v1/connectors
    return notImplemented("listConnectors");
  }

  async getConnectorStatus(connectorId: string): Promise<FivetranConnector> {
    this.assertConfigured();
    // TODO: GET https://api.fivetran.com/v1/connectors/{connectorId}
    void connectorId;
    return notImplemented("getConnectorStatus");
  }

  async getRecentSyncs(connectorId: string): Promise<FivetranSyncEvent[]> {
    this.assertConfigured();
    // TODO: GET https://api.fivetran.com/v1/connectors/{connectorId}/sync
    void connectorId;
    return notImplemented("getRecentSyncs");
  }

  async triggerSync(connectorId: string): Promise<TriggerSyncResult> {
    this.assertConfigured();
    // TODO: POST https://api.fivetran.com/v1/connectors/{connectorId}/force
    void connectorId;
    return notImplemented("triggerSync");
  }
}
