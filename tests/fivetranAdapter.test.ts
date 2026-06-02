import { describe, expect, it } from "vitest";

import { FIVETRAN_DEMO_NARRATIVE } from "@/lib/connectors/fivetranAdapter";
import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";

describe("MockFivetranAdapter", () => {
  it("lists connectors", async () => {
    const adapter = new MockFivetranAdapter();
    const connectors = await adapter.listConnectors();

    expect(connectors).toHaveLength(4);
    expect(connectors.map((item) => item.name)).toContain("Google Sheets CRM connector");
    expect(connectors.map((item) => item.name)).toContain("Commerce and payments connector");
    expect(connectors.map((item) => item.name)).toContain(
      "Customer engagement and analytics connector",
    );
    expect(connectors.every((item) => item.description.includes(FIVETRAN_DEMO_NARRATIVE))).toBe(true);
  });

  it("exposes warning status connector", async () => {
    const adapter = new MockFivetranAdapter();
    const connector = await adapter.getConnectorStatus("conn_zendesk_mock");

    expect(connector.health).toBe("warning");
    expect(connector.lastSyncStatus).toBe("failed");
  });

  it("returns connector table mappings", async () => {
    const adapter = new MockFivetranAdapter();
    const connector = await adapter.getConnectorStatus("conn_marketing_events");

    expect(connector.mappedTables).toEqual([
      "marketing_email_events",
      "analytics_customer_360",
      "ai_training_feedback_export",
    ]);
  });

  it("triggerSync returns verification status", async () => {
    const adapter = new MockFivetranAdapter();
    const result = await adapter.triggerSync("conn_stripe_mock");

    expect(result.accepted).toBe(true);
    expect(result.verificationStatus).toBe("queued");
    expect(result.connectorId).toBe("conn_stripe_mock");
    expect(result.requestedAtIso).toBeTruthy();
    const lowered = result.message.toLowerCase();
    expect(lowered.includes("deletion")).toBe(false);
    expect(lowered.includes("cleanup")).toBe(false);
    expect(lowered.includes("consent completion")).toBe(false);
    expect(lowered.includes("row mutation")).toBe(false);
  });

  it("rejects unknown connector id with clear errors", async () => {
    const adapter = new MockFivetranAdapter();

    await expect(adapter.getConnectorStatus("missing")).rejects.toThrow(/Unknown connector 'missing'/);
    await expect(adapter.getRecentSyncs("missing")).rejects.toThrow(/Unknown connector 'missing'/);
    await expect(adapter.triggerSync("missing")).rejects.toThrow(/Unknown connector 'missing'/);
  });

  it("returns recent sync events for each connector", async () => {
    const adapter = new MockFivetranAdapter();
    const connectorIds = [
      "conn_google_sheets_crm",
      "conn_stripe_mock",
      "conn_zendesk_mock",
      "conn_marketing_events",
    ];

    for (const connectorId of connectorIds) {
      const syncs = await adapter.getRecentSyncs(connectorId);
      expect(syncs.length).toBeGreaterThan(0);
      expect(syncs.every((event) => Boolean(event.startedAtIso))).toBe(true);
      expect(syncs.every((event) => Boolean(event.completedAtIso))).toBe(true);
    }
  });

  it("includes a failed Zendesk sync with zero processed records", async () => {
    const adapter = new MockFivetranAdapter();
    const syncs = await adapter.getRecentSyncs("conn_zendesk_mock");
    const failed = syncs.find((event) => event.status === "failed");

    expect(failed).toBeDefined();
    expect(failed?.recordsProcessed).toBe(0);
    expect(failed?.startedAtIso).toBeTruthy();
    expect(failed?.completedAtIso).toBeTruthy();
  });
});
