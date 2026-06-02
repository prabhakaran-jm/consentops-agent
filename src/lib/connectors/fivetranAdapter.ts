import type { WarehouseTableName } from "@/lib/warehouse/types";

export type FivetranConnectorHealth = "healthy" | "warning" | "offline";

export const FIVETRAN_DEMO_NARRATIVE =
  "Fivetran is the data movement layer that syncs operational sources into the local demo warehouse. The mock adapter only simulates connector status, sync history, and verification sync triggers. It does not perform cleanup.";

export interface FivetranSyncEvent {
  id: string;
  connectorId: string;
  startedAtIso: string;
  completedAtIso: string;
  status: "success" | "failed" | "running";
  recordsProcessed: number;
  message: string;
}

export interface FivetranConnector {
  id: string;
  name: string;
  description: string;
  source: string;
  destination: string;
  health: FivetranConnectorHealth;
  lastSyncedAtIso: string;
  lastSyncStatus: "success" | "failed";
  mappedTables: WarehouseTableName[];
}

export interface TriggerSyncResult {
  connectorId: string;
  accepted: boolean;
  verificationStatus: "queued" | "started";
  requestedAtIso: string;
  message: string;
}

export interface FivetranAdapter {
  listConnectors(): Promise<FivetranConnector[]>;
  getConnectorStatus(connectorId: string): Promise<FivetranConnector>;
  getRecentSyncs(connectorId: string): Promise<FivetranSyncEvent[]>;
  triggerSync(connectorId: string): Promise<TriggerSyncResult>;
}
