import { describe, expect, it } from "vitest";

import {
  connectorStatuses,
  demoAuditReport,
  demoCleanupPlan,
  demoMatchedRecords,
  demoSubject,
  demoWarehouseTables,
} from "@/lib/demo/seedData";
import { MATCH_FIELDS } from "@/lib/warehouse/types";

const wildcardTokens = new Set(["*", "all", "table_wide", "table-wide", "ALL"]);

describe("seed data consistency", () => {
  it("has exactly 37 subject matches and matching plan total", () => {
    expect(demoMatchedRecords).toHaveLength(37);
    expect(demoCleanupPlan.totalMatchesBeforeCleanup).toBe(37);
  });

  it("ensures every matched record appears in exactly one cleanup action", () => {
    const matchedRecordIds = demoMatchedRecords.map((entry) => entry.record.id);
    const actionRecordIds = demoCleanupPlan.actions.flatMap((action) => action.recordIds);

    expect(actionRecordIds).toHaveLength(37);
    expect(new Set(actionRecordIds).size).toBe(37);
    expect(new Set(actionRecordIds)).toEqual(new Set(matchedRecordIds));
  });

  it("includes delete, anonymize, retain, and review classifications", () => {
    const classifications = new Set(demoCleanupPlan.actions.map((action) => action.classification));
    expect(classifications.has("delete")).toBe(true);
    expect(classifications.has("anonymize")).toBe(true);
    expect(classifications.has("retain")).toBe(true);
    expect(classifications.has("review")).toBe(true);
  });

  it("keeps remaining count equal to retain plus review count", () => {
    const retainCount = demoCleanupPlan.actions.filter(
      (action) => action.classification === "retain",
    ).length;
    const reviewCount = demoCleanupPlan.actions.filter(
      (action) => action.classification === "review",
    ).length;

    expect(demoAuditReport.remainingMatchesAfterCleanup).toBe(retainCount + reviewCount);
  });

  it("retains payment transaction records only, with required reason", () => {
    const paymentActions = demoCleanupPlan.actions.filter(
      (action) => action.table === "payments_transactions",
    );

    expect(paymentActions.length).toBe(3);
    expect(paymentActions.every((action) => action.classification === "retain")).toBe(true);
    expect(
      paymentActions.every(
        (action) => action.retainReason === "Financial retention review required",
      ),
    ).toBe(true);
  });

  it("requires reasons for all retained records", () => {
    const retained = demoCleanupPlan.actions.filter((action) => action.classification === "retain");
    expect(retained.length).toBeGreaterThan(0);
    expect(
      retained.every((action) => typeof action.retainReason === "string" && action.retainReason.length > 0),
    ).toBe(true);
  });

  it("has connector statuses with at least one warning connector", () => {
    expect(connectorStatuses.length).toBeGreaterThan(0);
    expect(connectorStatuses.some((status) => status.health !== "healthy")).toBe(true);
  });

  it("contains direct email, customerId, and derived emailSha256 matches", () => {
    const allRecords = demoWarehouseTables.flatMap((table) => table.records);

    expect(allRecords.some((record) => record[MATCH_FIELDS.email] === demoSubject.email)).toBe(true);
    expect(
      allRecords.some((record) => record[MATCH_FIELDS.customerId] === demoSubject.customerId),
    ).toBe(true);
    expect(
      allRecords.some((record) => record[MATCH_FIELDS.emailSha256] === demoSubject.emailSha256),
    ).toBe(true);
  });

  it("does not allow empty or wildcard record targeting in actions", () => {
    for (const action of demoCleanupPlan.actions) {
      expect(action.recordIds.length).toBeGreaterThan(0);
      expect(action.recordIds.every((recordId) => !wildcardTokens.has(recordId))).toBe(true);
    }
  });
});
