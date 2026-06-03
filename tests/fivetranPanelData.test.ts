import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MockFivetranAdapter } from "@/lib/connectors/mockFivetranAdapter";
import {
  getFivetranAdapter,
  getFivetranPanelMode,
} from "@/lib/connectors/fivetranAdapterFactory";
import {
  buildFivetranConnectorPanelData,
  getFivetranConnectorPanelData,
  toRedactedPanelItems,
} from "@/lib/connectors/fivetranPanelData";

describe("fivetran adapter factory", () => {
  const savedEnv = {
    FIVETRAN_API_KEY: process.env.FIVETRAN_API_KEY,
    FIVETRAN_API_SECRET: process.env.FIVETRAN_API_SECRET,
  };

  beforeEach(() => {
    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns mock mode when credentials are missing", () => {
    expect(getFivetranPanelMode()).toBe("mock");
    expect(getFivetranAdapter()).toBeInstanceOf(MockFivetranAdapter);
  });

  it("labels real_configured_stub when credentials exist but stays on mock adapter", () => {
    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";

    expect(getFivetranPanelMode()).toBe("real_configured_stub");
    expect(getFivetranAdapter()).toBeInstanceOf(MockFivetranAdapter);
  });
});

describe("fivetran panel data", () => {
  it("redacts raw connector ids from panel items", async () => {
    const adapter = new MockFivetranAdapter();
    const connectors = await adapter.listConnectors();
    const items = toRedactedPanelItems(connectors);
    const serialized = JSON.stringify(items);

    expect(items.every((item) => item.displayKey.startsWith("connector_"))).toBe(true);
    expect(serialized).not.toContain("conn_zendesk_mock");
    expect(serialized).not.toContain("conn_stripe_mock");
  });

  it("builds health summary and read-only panel payload", async () => {
    const panel = await getFivetranConnectorPanelData();

    expect(panel.connectionCount).toBe(4);
    expect(panel.healthSummary.healthy).toBeGreaterThan(0);
    expect(panel.readOnlyNote.toLowerCase()).toContain("read-only");
    expect(panel.modeLabel.toLowerCase()).toContain("mock");
  });

  it("uses real_configured_stub label when credentials are set", async () => {
    process.env.FIVETRAN_API_KEY = "plant-key";
    process.env.FIVETRAN_API_SECRET = "plant-secret";

    const adapter = new MockFivetranAdapter();
    const panel = buildFivetranConnectorPanelData(await adapter.listConnectors());

    expect(panel.mode).toBe("real_configured_stub");
    expect(panel.modeLabel).toContain("stubbed");

    delete process.env.FIVETRAN_API_KEY;
    delete process.env.FIVETRAN_API_SECRET;
  });
});
