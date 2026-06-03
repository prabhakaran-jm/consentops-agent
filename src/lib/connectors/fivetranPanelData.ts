import type { FivetranConnector, FivetranConnectorHealth } from "@/lib/connectors/fivetranAdapter";
import {
  getFivetranAdapter,
  getFivetranModeLabel,
  getFivetranPanelMode,
  type FivetranPanelMode,
} from "@/lib/connectors/fivetranAdapterFactory";
import type { WarehouseTableName } from "@/lib/warehouse/types";

export const FIVETRAN_READ_ONLY_NOTE =
  "Read-only connector status for the demo. No sync triggers, writes, or cleanup via Fivetran.";

export type FivetranConnectorPanelItem = {
  displayKey: string;
  name: string;
  source: string;
  destination: string;
  health: FivetranConnectorHealth;
  lastSyncedAtIso: string;
  lastSyncStatus: "success" | "failed";
  mappedTables: WarehouseTableName[];
};

export type FivetranHealthSummary = {
  healthy: number;
  warning: number;
  offline: number;
};

export type FivetranConnectorPanelData = {
  mode: FivetranPanelMode;
  modeLabel: string;
  readOnlyNote: string;
  connectionCount: number;
  healthSummary: FivetranHealthSummary;
  connectors: FivetranConnectorPanelItem[];
};

const summarizeHealth = (connectors: FivetranConnector[]): FivetranHealthSummary => ({
  healthy: connectors.filter((c) => c.health === "healthy").length,
  warning: connectors.filter((c) => c.health === "warning").length,
  offline: connectors.filter((c) => c.health === "offline").length,
});

export const toRedactedPanelItems = (connectors: FivetranConnector[]): FivetranConnectorPanelItem[] =>
  [...connectors]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((connector, index) => ({
      displayKey: `connector_${String(index + 1).padStart(2, "0")}`,
      name: connector.name,
      source: connector.source,
      destination: connector.destination,
      health: connector.health,
      lastSyncedAtIso: connector.lastSyncedAtIso,
      lastSyncStatus: connector.lastSyncStatus,
      mappedTables: [...connector.mappedTables],
    }));

export const buildFivetranConnectorPanelData = (
  connectors: FivetranConnector[],
  mode: FivetranPanelMode = getFivetranPanelMode(),
): FivetranConnectorPanelData => ({
  mode,
  modeLabel: getFivetranModeLabel(mode),
  readOnlyNote: FIVETRAN_READ_ONLY_NOTE,
  connectionCount: connectors.length,
  healthSummary: summarizeHealth(connectors),
  connectors: toRedactedPanelItems(connectors),
});

export const getFivetranConnectorPanelData = async (): Promise<FivetranConnectorPanelData> => {
  const adapter = getFivetranAdapter();
  const connectors = await adapter.listConnectors();
  return buildFivetranConnectorPanelData(connectors);
};
