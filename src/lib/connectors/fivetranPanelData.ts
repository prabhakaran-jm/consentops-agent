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

export const LIVE_FIVETRAN_EMPTY_CONNECTIONS_HINT =
  "Live Fivetran API returned 0 connections. Add a connector in the Fivetran dashboard (destination: BigQuery on your GCP project), then run Scan again. See docs/bigquery-demo-setup.md.";

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
  emptyConnectionsHint: string | null;
  healthSummary: FivetranHealthSummary;
  connectors: FivetranConnectorPanelItem[];
};

const summarizeHealth = (connectors: FivetranConnector[]): FivetranHealthSummary => ({
  healthy: connectors.filter((c) => c.health === "healthy").length,
  warning: connectors.filter((c) => c.health === "warning").length,
  offline: connectors.filter((c) => c.health === "offline").length,
});

const redactLiveConnectorFields = (
  connector: FivetranConnector,
  displayKey: string,
): Pick<FivetranConnectorPanelItem, "name" | "destination"> => {
  const sourceLabel = connector.source.replace(/_/g, " ");
  return {
    name: `${sourceLabel} connector (${displayKey})`,
    destination: connector.destination.toLowerCase().includes("bigquery")
      ? "BigQuery warehouse"
      : "Demo warehouse destination",
  };
};

export const toRedactedPanelItems = (
  connectors: FivetranConnector[],
  mode: FivetranPanelMode = "mock",
): FivetranConnectorPanelItem[] =>
  [...connectors]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((connector, index) => {
      const displayKey = `connector_${String(index + 1).padStart(2, "0")}`;
      const liveFields =
        mode === "mock" ? null : redactLiveConnectorFields(connector, displayKey);
      return {
        displayKey,
        name: liveFields?.name ?? connector.name,
        source: connector.source,
        destination: liveFields?.destination ?? connector.destination,
        health: connector.health,
        lastSyncedAtIso: connector.lastSyncedAtIso,
        lastSyncStatus: connector.lastSyncStatus,
        mappedTables: [...connector.mappedTables],
      };
    });

export const buildFivetranConnectorPanelData = (
  connectors: FivetranConnector[],
  mode: FivetranPanelMode = getFivetranPanelMode(),
): FivetranConnectorPanelData => ({
  mode,
  modeLabel: getFivetranModeLabel(mode),
  readOnlyNote: FIVETRAN_READ_ONLY_NOTE,
  connectionCount: connectors.length,
  emptyConnectionsHint:
    (mode === "live_read_only" || mode === "mcp_runtime") && connectors.length === 0
      ? LIVE_FIVETRAN_EMPTY_CONNECTIONS_HINT
      : null,
  healthSummary: summarizeHealth(connectors),
  connectors: toRedactedPanelItems(connectors, mode),
});

export const getFivetranConnectorPanelData = async (): Promise<FivetranConnectorPanelData> => {
  const adapter = getFivetranAdapter();
  const connectors = await adapter.listConnectors();
  return buildFivetranConnectorPanelData(connectors);
};
