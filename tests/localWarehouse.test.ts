import { describe, expect, it } from "vitest";

import {
  demoCleanupPlan,
  demoSubject,
  demoWarehouseTables,
  getEmailSha256,
} from "@/lib/demo/seedData";
import {
  buildDataSpreadMap,
  countMatchesByTable,
  scanSubjectAcrossWarehouse,
  verifyNoUnclassifiedMatches,
} from "@/lib/warehouse/localWarehouse";
import { MATCH_FIELDS } from "@/lib/warehouse/types";
import type { ConsentSubject, WarehouseTable } from "@/lib/warehouse/types";

const makeSubject = (overrides: Partial<ConsentSubject> = {}): ConsentSubject => ({
  ...demoSubject,
  ...overrides,
});

const scanFixture = (subject: ConsentSubject, table: WarehouseTable) =>
  scanSubjectAcrossWarehouse(subject, [table]);

describe("local warehouse scanner", () => {
  it("finds direct email matches (case-insensitive)", () => {
    const matches = scanSubjectAcrossWarehouse(
      { ...demoSubject, email: "ANA.REYES@EXAMPLE.COM" },
      demoWarehouseTables,
    );

    expect(
      matches.some((match) => match.matchedFields.includes(MATCH_FIELDS.email)),
    ).toBe(true);
  });

  it("finds customerId matches", () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables);
    expect(
      matches.some((match) => match.matchedFields.includes(MATCH_FIELDS.customerId)),
    ).toBe(true);
  });

  it("finds hashed email matches", () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables);
    expect(
      matches.some((match) => match.matchedFields.includes(MATCH_FIELDS.emailSha256)),
    ).toBe(true);
  });

  it("does not match unrelated records", () => {
    const unrelatedSubject = {
      ...demoSubject,
      email: "nobody@nowhere.test",
      phone: "+1-555-9999",
      customerId: "cus_0000",
      emailSha256: getEmailSha256("nobody@nowhere.test"),
    };

    const matches = scanSubjectAcrossWarehouse(unrelatedSubject, demoWarehouseTables);
    expect(matches).toHaveLength(0);
  });

  it("returns grouped table counts", () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables);
    const groupedCounts = countMatchesByTable(matches);

    expect(groupedCounts.crm_customers).toBe(3);
    expect(groupedCounts.commerce_orders).toBe(6);
    expect(groupedCounts.support_tickets).toBe(5);
    expect(groupedCounts.marketing_email_events).toBe(6);
    expect(groupedCounts.analytics_customer_360).toBe(7);
    expect(groupedCounts.ai_training_feedback_export).toBe(7);
    expect(groupedCounts.payments_transactions).toBe(3);
  });

  it("builds spread map and validates cleanup coverage", () => {
    const matches = scanSubjectAcrossWarehouse(demoSubject, demoWarehouseTables);
    const spreadMap = buildDataSpreadMap(matches);
    const uncovered = verifyNoUnclassifiedMatches(matches, demoCleanupPlan.actions);

    expect(spreadMap.crm_customers?.totalMatches).toBe(3);
    expect(spreadMap.payments_transactions?.transactionRecordMatches).toBe(3);
    expect(spreadMap.analytics_customer_360?.derivedIdentifierMatches).toBe(7);
    expect(uncovered).toHaveLength(0);
  });

  it("assigns high confidence for customerId matches", () => {
    const matches = scanFixture(
      makeSubject({ email: "none@example.test", phone: "+1-000-0000", emailSha256: "nohash" }),
      {
        name: "crm_customers",
        records: [{ id: "crm_customers_x1", customerId: demoSubject.customerId }],
      },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("high");
  });

  it("assigns high confidence for email matches", () => {
    const matches = scanFixture(
      makeSubject({ phone: "+1-000-0000", customerId: "cus_none", emailSha256: "nohash" }),
      {
        name: "crm_customers",
        records: [{ id: "crm_customers_x2", email: "ANA.REYES@EXAMPLE.COM" }],
      },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("high");
  });

  it("assigns high confidence for phone matches", () => {
    const matches = scanFixture(
      makeSubject({ email: "none@example.test", customerId: "cus_none", emailSha256: "nohash" }),
      {
        name: "support_tickets",
        records: [{ id: "support_tickets_x1", phone: demoSubject.phone }],
      },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("high");
  });

  it("assigns medium confidence for emailSha256-only matches", () => {
    const matches = scanFixture(
      makeSubject({ email: "none@example.test", phone: "+1-000-0000", customerId: "cus_none" }),
      {
        name: "analytics_customer_360",
        records: [{ id: "analytics_customer_360_x1", emailSha256: demoSubject.emailSha256 }],
      },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("medium");
    expect(matches[0]?.suggestedSensitivity).toBe("derived_identifier");
  });

  it("returns no matches when identifiers do not match", () => {
    const matches = scanFixture(
      makeSubject(),
      {
        name: "crm_customers",
        records: [
          {
            id: "crm_customers_x3",
            email: "other@example.test",
            phone: "+1-555-0000",
            customerId: "cus_other",
            emailSha256: "other_hash",
          },
        ],
      },
    );

    expect(matches).toHaveLength(0);
  });

  it("does not match empty subject identifiers to empty record fields", () => {
    const emptySubject = makeSubject({
      email: "",
      phone: "",
      customerId: "",
      emailSha256: "",
    });

    const matches = scanFixture(emptySubject, {
      name: "crm_customers",
      records: [
        {
          id: "crm_customers_empty",
          email: "",
          phone: "",
          customerId: "",
          emailSha256: "",
        },
      ],
    });

    expect(matches).toHaveLength(0);
  });

  it("reports high and medium confidence totals in spread map", () => {
    const subject = makeSubject({
      email: "ana.reyes@example.com",
      phone: "+1-555-0188",
      customerId: "cus_1029",
      emailSha256: "ana_hash_for_test",
    });

    const matches = scanSubjectAcrossWarehouse(subject, [
      {
        name: "crm_customers",
        records: [{ id: "crm_customers_h1", customerId: "cus_1029" }],
      },
      {
        name: "analytics_customer_360",
        records: [{ id: "analytics_customer_360_m1", emailSha256: "ana_hash_for_test" }],
      },
    ]);

    const spreadMap = buildDataSpreadMap(matches);
    expect(spreadMap.crm_customers?.highConfidenceMatches).toBe(1);
    expect(spreadMap.analytics_customer_360?.mediumConfidenceMatches).toBe(1);
  });
});
