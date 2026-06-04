import { describe, expect, it } from "vitest";

import {
  buildBasicAuthHeader,
  inferConnectorHealth,
  inferMappedTables,
  redactFivetranSecrets,
} from "@/lib/connectors/fivetranRestClient";
import {
  ReadOnlyFivetranError,
  RealFivetranAdapter,
} from "@/lib/connectors/realFivetranAdapter";
import type { FivetranHttpClient } from "@/lib/connectors/fivetranRestClient";

const PLANTED_SECRET = "plant-fivetran-secret-abc";

describe("RealFivetranAdapter read-only REST", () => {
  const mockClient: FivetranHttpClient = {
    async get(path: string) {
      if (path.startsWith("/connections")) {
        return {
          code: "Success",
          data: {
            items: [
              {
                id: "conn_live_1",
                service: "google_sheets",
                schema: "crm",
                succeeded_at: "2026-06-01T12:00:00.000Z",
                status: { setup_state: "connected", sync_state: "scheduled" },
              },
            ],
          },
        };
      }
      return { code: "Success", data: { items: [] } };
    },
  };

  const adapter = new RealFivetranAdapter(
    { apiKey: "plant-key", apiSecret: PLANTED_SECRET },
    mockClient,
  );

  it("lists connectors from live API shape", async () => {
    const connectors = await adapter.listConnectors();
    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.source).toBe("google_sheets");
    expect(connectors[0]?.mappedTables).toContain("crm_customers");
  });

  it("rejects triggerSync as read-only", async () => {
    await expect(adapter.triggerSync("conn_live_1")).rejects.toBeInstanceOf(ReadOnlyFivetranError);
  });

  it("redacts secrets from REST error messages", () => {
    const message = redactFivetranSecrets(`failed auth ${PLANTED_SECRET}`, "plant-key", PLANTED_SECRET);
    expect(message).not.toContain(PLANTED_SECRET);
    expect(message).toContain("[REDACTED]");
  });
});

describe("fivetran REST helpers", () => {
  it("maps service hints to demo warehouse tables", () => {
    expect(inferMappedTables("stripe")).toContain("payments_transactions");
  });

  it("infers warning health when sync failed recently", () => {
    expect(
      inferConnectorHealth({
        id: "x",
        failed_at: "2026-06-02T00:00:00.000Z",
        succeeded_at: "2026-06-01T00:00:00.000Z",
      }),
    ).toBe("warning");
  });

  it("builds basic auth header", () => {
    expect(buildBasicAuthHeader("user", "pass")).toMatch(/^Basic /);
  });
});
