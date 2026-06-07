import { describe, expect, it } from "vitest";

import {
  buildFivetranAliasMap,
  sanitizePublicText,
  sanitizeToolData,
} from "@/lib/connectors/fivetranPublicSanitizer";

const sampleItems = [
  {
    id: "brandy_indictment",
    group_id: "cashier_physically",
    connected_by: "fair_fender",
    service: "bigquery_db",
    schema: "brandy_indictment",
  },
  {
    id: "metadata_log",
    group_id: "cashier_physically",
    service: "fivetran_log",
    schema: "fivetran_metadata_demo",
  },
];

describe("fivetranPublicSanitizer", () => {
  it("builds stable aliases for connection, group, user, and schema ids", () => {
    const aliasMap = buildFivetranAliasMap(sampleItems);

    expect(aliasMap.connectionIdToAlias.get("brandy_indictment")).toBe("connector_01");
    expect(aliasMap.connectionIdToAlias.get("metadata_log")).toBe("connector_02");
    expect(aliasMap.groupIdToAlias.get("cashier_physically")).toBe("destination_01");
    expect(aliasMap.userIdToAlias.get("fair_fender")).toBe("account_user_01");
    expect(aliasMap.schemaToAlias.get("brandy_indictment")).toBe("demo_schema_01");
  });

  it("sanitizes nested tool payloads and summaries", () => {
    const aliasMap = buildFivetranAliasMap(sampleItems);
    const sanitized = sanitizeToolData(
      {
        connection_id: "brandy_indictment",
        schema: "brandy_indictment",
        destination_groups: ["cashier_physically"],
        items: [{ id: "metadata_log", schema: "fivetran_metadata_demo" }],
      },
      aliasMap,
    ) as Record<string, unknown>;

    expect(sanitized.connection_id).toBe("connector_01");
    expect(sanitized.schema).toBe("demo_schema_01");
    expect(sanitized.destination_groups).toEqual(["destination_01"]);
    expect((sanitized.items as Array<{ id: string }>)[0]?.id).toBe("connector_02");

    const summary = sanitizePublicText(
      "Connection brandy_indictment (bigquery_db → schema brandy_indictment) in group cashier_physically",
      aliasMap,
    );
    expect(summary).not.toContain("brandy_indictment");
    expect(summary).not.toContain("cashier_physically");
    expect(summary).toContain("demo_schema_01");
    expect(summary).toContain("destination_01");
  });
});
