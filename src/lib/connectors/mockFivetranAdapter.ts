import type {
  FivetranAdapter,
  FivetranConnector,
  FivetranSyncEvent,
  TriggerSyncResult,
} from "@/lib/connectors/fivetranAdapter";
import { FIVETRAN_DEMO_NARRATIVE } from "@/lib/connectors/fivetranAdapter";

const now = Date.now();
const minutesAgoIso = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();

const mockConnectors: FivetranConnector[] = [
  {
    id: "conn_google_sheets_crm",
    name: "Google Sheets CRM connector",
    description: `${FIVETRAN_DEMO_NARRATIVE} Source focus: CRM contacts from Google Sheets.`,
    source: "google_sheets",
    destination: "local_json_warehouse",
    health: "healthy",
    lastSyncedAtIso: minutesAgoIso(3),
    lastSyncStatus: "success",
    mappedTables: ["crm_customers"],
  },
  {
    id: "conn_stripe_mock",
    name: "Commerce and payments connector",
    description: `${FIVETRAN_DEMO_NARRATIVE} Source focus: commerce orders and payment transaction feeds.`,
    source: "stripe",
    destination: "local_json_warehouse",
    health: "healthy",
    lastSyncedAtIso: minutesAgoIso(8),
    lastSyncStatus: "success",
    mappedTables: ["payments_transactions", "commerce_orders"],
  },
  {
    id: "conn_zendesk_mock",
    name: "Zendesk mock connector",
    description: `${FIVETRAN_DEMO_NARRATIVE} Source focus: support ticket movement, currently warning.`,
    source: "zendesk",
    destination: "local_json_warehouse",
    health: "warning",
    lastSyncedAtIso: minutesAgoIso(19),
    lastSyncStatus: "failed",
    mappedTables: ["support_tickets"],
  },
  {
    id: "conn_marketing_events",
    name: "Customer engagement and analytics connector",
    description: `${FIVETRAN_DEMO_NARRATIVE} Source focus: marketing events and downstream analytics exports.`,
    source: "segment",
    destination: "local_json_warehouse",
    health: "healthy",
    lastSyncedAtIso: minutesAgoIso(12),
    lastSyncStatus: "success",
    mappedTables: ["marketing_email_events", "analytics_customer_360", "ai_training_feedback_export"],
  },
];

const mockSyncEventsByConnector: Record<string, FivetranSyncEvent[]> = {
  conn_google_sheets_crm: [
    {
      id: "sync_google_001",
      connectorId: "conn_google_sheets_crm",
      startedAtIso: minutesAgoIso(4),
      completedAtIso: minutesAgoIso(3),
      status: "success",
      recordsProcessed: 38,
      message: "CRM rows loaded from sheet.",
    },
  ],
  conn_stripe_mock: [
    {
      id: "sync_stripe_001",
      connectorId: "conn_stripe_mock",
      startedAtIso: minutesAgoIso(9),
      completedAtIso: minutesAgoIso(8),
      status: "success",
      recordsProcessed: 24,
      message: "Stripe transactions replicated.",
    },
  ],
  conn_zendesk_mock: [
    {
      id: "sync_zendesk_001",
      connectorId: "conn_zendesk_mock",
      startedAtIso: minutesAgoIso(20),
      completedAtIso: minutesAgoIso(19),
      status: "failed",
      recordsProcessed: 0,
      message: "Source API timeout during ticket sync.",
    },
  ],
  conn_marketing_events: [
    {
      id: "sync_marketing_001",
      connectorId: "conn_marketing_events",
      startedAtIso: minutesAgoIso(13),
      completedAtIso: minutesAgoIso(12),
      status: "success",
      recordsProcessed: 112,
      message: "Marketing events upserted.",
    },
  ],
};

export class MockFivetranAdapter implements FivetranAdapter {
  async listConnectors(): Promise<FivetranConnector[]> {
    return mockConnectors.map((connector) => ({ ...connector, mappedTables: [...connector.mappedTables] }));
  }

  async getConnectorStatus(connectorId: string): Promise<FivetranConnector> {
    const connector = mockConnectors.find((item) => item.id === connectorId);
    if (!connector) {
      throw new Error(`Unknown connector '${connectorId}' in mock Fivetran adapter.`);
    }
    return { ...connector, mappedTables: [...connector.mappedTables] };
  }

  async getRecentSyncs(connectorId: string): Promise<FivetranSyncEvent[]> {
    if (!mockConnectors.some((item) => item.id === connectorId)) {
      throw new Error(`Unknown connector '${connectorId}' in mock Fivetran adapter.`);
    }

    return (mockSyncEventsByConnector[connectorId] ?? []).map((event) => ({ ...event }));
  }

  async triggerSync(connectorId: string): Promise<TriggerSyncResult> {
    if (!mockConnectors.some((item) => item.id === connectorId)) {
      throw new Error(`Unknown connector '${connectorId}' in mock Fivetran adapter.`);
    }

    return {
      connectorId,
      accepted: true,
      verificationStatus: "queued",
      requestedAtIso: new Date().toISOString(),
      message: "Mock sync trigger accepted for connector health verification polling.",
    };
  }
}
