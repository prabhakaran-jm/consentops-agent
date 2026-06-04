import { describe, expect, it } from "vitest";

import {
  countBigQuerySeedRows,
  mapRecordToBigQueryRow,
  mapWarehouseTablesToBigQueryRows,
} from "@/lib/demo/bigQuerySeedExport";
import { demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";

describe("bigQuery seed export", () => {
  it("maps marketing event field to campaign column", () => {
    const row = mapRecordToBigQueryRow("marketing_email_events", {
      id: "marketing_email_events_001",
      email: demoSubject.email,
      customerId: demoSubject.customerId,
      event: "open",
    });

    expect(row.campaign).toBe("open");
    expect(row.emailSha256).toBe(demoSubject.emailSha256);
  });

  it("exports all demo warehouse tables with stable ids", () => {
    const rowsByTable = mapWarehouseTablesToBigQueryRows(demoWarehouseTables);
    expect(rowsByTable.crm_customers.some((row) => row.id === "crm_customers_001")).toBe(true);
    expect(countBigQuerySeedRows(demoWarehouseTables)).toBeGreaterThan(30);
  });
});
