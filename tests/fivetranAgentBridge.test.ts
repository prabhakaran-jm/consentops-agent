import { describe, expect, it } from "vitest";

import {
  enrichFivetranToolFromListConnections,
  isEmptyFivetranToolData,
} from "@/lib/connectors/fivetranAgentBridge";

const sampleListPayload = {
  code: "Success",
  data: {
    items: [
      {
        id: "brandy_indictment",
        group_id: "cashier_physically",
        service: "bigquery_db",
        schema: "bigquery_db",
        succeeded_at: "2026-06-07T08:41:39.555000Z",
        status: { setup_state: "connected", sync_state: "scheduled" },
      },
      {
        id: "motioned_drudgery",
        group_id: "cashier_physically",
        service: "fivetran_log",
        schema: "fivetran_metadata_cashier_physically",
        succeeded_at: "2026-06-07T08:42:11.954000Z",
        status: { setup_state: "connected", sync_state: "scheduled" },
      },
    ],
  },
};

describe("fivetranAgentBridge enrichment", () => {
  it("detects empty MCP payloads", () => {
    expect(isEmptyFivetranToolData(null)).toBe(true);
    expect(isEmptyFivetranToolData({})).toBe(true);
    expect(isEmptyFivetranToolData({ code: "Success" })).toBe(false);
  });

  it("enriches get_account_info from list_connections", () => {
    const data = enrichFivetranToolFromListConnections(
      "get_account_info",
      {},
      sampleListPayload,
    ) as Record<string, unknown>;

    expect(data.connection_count).toBe(2);
    expect(data.destination_groups).toEqual(["cashier_physically"]);
    expect(data.services).toEqual(expect.arrayContaining(["bigquery_db", "fivetran_log"]));
    expect(data.read_only).toBe(true);
  });

  it("enriches get_connection_details from list_connections", () => {
    const data = enrichFivetranToolFromListConnections(
      "get_connection_details",
      { connection_id: "brandy_indictment" },
      sampleListPayload,
    ) as Record<string, unknown>;

    expect(data.id).toBe("brandy_indictment");
    expect(data.service).toBe("bigquery_db");
    expect(data.enrichedFrom).toBe("list_connections");
  });

  it("enriches get_connection_state from list_connections", () => {
    const data = enrichFivetranToolFromListConnections(
      "get_connection_state",
      { connection_id: "motioned_drudgery" },
      sampleListPayload,
    ) as Record<string, unknown>;

    expect(data.connection_id).toBe("motioned_drudgery");
    expect(data.sync_state).toBe("scheduled");
    expect(data.succeeded_at).toBe("2026-06-07T08:42:11.954000Z");
  });

  it("enriches list_destinations from list_connections groups", () => {
    const data = enrichFivetranToolFromListConnections(
      "list_destinations",
      {},
      sampleListPayload,
    ) as { items: Array<{ id: string; connections: unknown[] }> };

    expect(data.items).toHaveLength(1);
    expect(data.items[0]?.id).toBe("cashier_physically");
    expect(data.items[0]?.connections).toHaveLength(2);
  });
});
