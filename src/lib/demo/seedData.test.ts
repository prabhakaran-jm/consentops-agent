import { describe, expect, it } from "vitest";

import { demoAuditReport, demoSubject, demoWarehouseTables } from "@/lib/demo/seedData";

const hasDirectIdentifierMatch = (record: Record<string, unknown>) =>
  record.email === demoSubject.email ||
  record.phone === demoSubject.phone ||
  record.customerId === demoSubject.customerId;

const hasDerivedIdentifierMatch = (record: Record<string, unknown>) =>
  record.emailSha256 === demoSubject.emailSha256;

describe("demo seed data", () => {
  it("includes direct identifier matches", () => {
    const directMatches = demoWarehouseTables.flatMap((table) =>
      table.records.filter(hasDirectIdentifierMatch),
    );

    expect(directMatches.length).toBeGreaterThan(0);
  });

  it("includes derived identifier matches", () => {
    const derivedMatches = demoWarehouseTables.flatMap((table) =>
      table.records.filter(hasDerivedIdentifierMatch),
    );

    expect(derivedMatches.length).toBeGreaterThan(0);
  });

  it("contains the expected before and after demo counts", () => {
    const totalMatches = demoWarehouseTables.flatMap((table) =>
      table.records.filter(
        (record) => hasDirectIdentifierMatch(record) || hasDerivedIdentifierMatch(record),
      ),
    ).length;

    expect(totalMatches).toBe(37);
    expect(demoAuditReport.totalMatchesBeforeCleanup).toBe(37);
    expect(demoAuditReport.remainingMatchesAfterCleanup).toBe(3);
    expect(demoAuditReport.retainedRecords).toHaveLength(3);
    expect(demoAuditReport.retainedRecords.every((action) => action.classification === "retain")).toBe(
      true,
    );
    expect(
      demoAuditReport.retainedRecords.every(
        (action) => action.retainReason === "Financial retention review required",
      ),
    ).toBe(true);
  });
});
