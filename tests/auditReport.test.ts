import { describe, expect, it } from "vitest";

import {
  AUDIT_DISCLAIMER,
  formatAuditReportJson,
  formatAuditReportMarkdown,
  generateAuditReport,
} from "@/lib/audit/auditReport";
import { demoSubject } from "@/lib/demo/seedData";
import type { CleanupAction, CleanupPlan } from "@/lib/warehouse/types";

const samplePlan: CleanupPlan = {
  id: "plan_test",
  subjectId: demoSubject.id,
  createdAtIso: "2026-06-02T10:00:00.000Z",
  totalMatchesBeforeCleanup: 2,
  actions: [
    {
      id: "act_delete_1",
      table: "crm_customers",
      recordIds: ["crm_customers_001"],
      classification: "delete",
      fields: ["email"],
    },
    {
      id: "act_retain_1",
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
      classification: "retain",
      fields: ["email", "customerId"],
      retainReason: "Financial retention review required",
    },
  ],
};

const planWithReview: CleanupPlan = {
  id: "plan_review_fixture",
  subjectId: demoSubject.id,
  createdAtIso: "2026-06-02T10:00:00.000Z",
  totalMatchesBeforeCleanup: 4,
  actions: [
    {
      id: "act_delete_1",
      table: "crm_customers",
      recordIds: ["crm_customers_001"],
      classification: "delete",
      fields: ["email"],
    },
    {
      id: "act_review_1",
      table: "support_tickets",
      recordIds: ["support_tickets_005"],
      classification: "review",
      fields: ["email", "customerId"],
    },
    {
      id: "act_retain_pay",
      table: "payments_transactions",
      recordIds: ["payments_transactions_001"],
      classification: "retain",
      fields: ["email", "customerId", "amount"],
      retainReason: "Financial retention review required",
    },
    {
      id: "act_anonymize_1",
      table: "marketing_email_events",
      recordIds: ["marketing_email_events_001"],
      classification: "anonymize",
      fields: ["email"],
    },
  ],
};

const sampleConnectors = [
  {
    id: "conn_test",
    name: "Test connector",
    description: "demo",
    source: "test",
    destination: "local_json_warehouse",
    health: "healthy" as const,
    lastSyncedAtIso: "2026-06-02T09:00:00.000Z",
    lastSyncStatus: "success" as const,
    mappedTables: ["crm_customers" as const],
  },
];

describe("audit report generation", () => {
  it("includes before and after counts", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers", "payments_transactions"],
      recordsFoundBefore: 37,
      plan: samplePlan,
      approval: {
        approvalId: "approval_test",
        approvedActionIds: ["act_delete_1", "act_retain_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_delete_1"],
      recordsRemainingAfter: 5,
    });

    expect(report.recordsFoundBefore).toBe(37);
    expect(report.recordsRemainingAfter).toBe(5);
    expect(report.verificationResult.recordsFoundOnLiveRescan).toBe(5);
  });

  it("includes approval info", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers"],
      recordsFoundBefore: 2,
      plan: samplePlan,
      approval: {
        approvalId: "approval_xyz",
        approvedActionIds: ["act_delete_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_delete_1"],
      recordsRemainingAfter: 1,
    });

    expect(report.approval.approvalId).toBe("approval_xyz");
    expect(report.approval.approvedBy).toBe("demo-reviewer");
    expect(report.actionsApproved).toHaveLength(1);
    expect(report.actionsExecuted).toHaveLength(1);
  });

  it("requires reasons on all retained records", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["payments_transactions"],
      recordsFoundBefore: 1,
      plan: samplePlan,
      approval: {
        approvalId: "approval_retain",
        approvedActionIds: ["act_retain_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_retain_1"],
      recordsRemainingAfter: 1,
    });

    expect(report.retainedRecordsWithReasons.length).toBe(1);
    expect(report.retainedRecordsWithReasons[0]?.reason.length).toBeGreaterThan(0);

    const badPlan: CleanupPlan = {
      ...samplePlan,
      actions: [
        {
          id: "act_bad_retain",
          table: "payments_transactions",
          recordIds: ["payments_transactions_002"],
          classification: "retain",
          fields: ["email"],
        } as CleanupAction,
      ],
    };

    expect(() =>
      generateAuditReport({
        subject: demoSubject,
        connectors: sampleConnectors,
        warehouseTablesScanned: ["payments_transactions"],
        recordsFoundBefore: 1,
        plan: badPlan,
        approval: {
          approvalId: "a",
          approvedActionIds: [],
          approvedBy: "demo-reviewer",
          approvedAt: "2026-06-02T10:05:00.000Z",
        },
        executedActionIds: [],
        recordsRemainingAfter: 1,
      }),
    ).toThrow(/missing a required reason/);
  });

  it("does not claim legal compliance", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers"],
      recordsFoundBefore: 1,
      plan: samplePlan,
      approval: {
        approvalId: "approval_legal",
        approvedActionIds: [],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: [],
      recordsRemainingAfter: 0,
    });

    const markdown = formatAuditReportMarkdown(report);
    const json = formatAuditReportJson(report);

    expect(report.disclaimer).toBe(AUDIT_DISCLAIMER);
    expect(report.disclaimer.toLowerCase()).toContain("not legal advice");
    expect(markdown.toLowerCase()).not.toContain("gdpr compliant");
    expect(markdown.toLowerCase()).not.toContain("legally compliant");
    expect(json.toLowerCase()).not.toContain("certifies compliance");
  });

  it("renders review actions honestly in markdown and json", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers", "support_tickets", "payments_transactions"],
      recordsFoundBefore: 12,
      plan: planWithReview,
      approval: {
        approvalId: "approval_review",
        approvedActionIds: ["act_review_1", "act_retain_pay"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_review_1"],
      recordsRemainingAfter: 9,
    });

    const markdown = formatAuditReportMarkdown(report);
    const json = formatAuditReportJson(report);

    expect(markdown.toLowerCase()).toMatch(/live re-scan|post-execution re-scan/);
    expect(markdown).toContain("**review**");
    expect(markdown).toContain("act_review_1");
    expect(markdown.toLowerCase()).not.toMatch(/act_review_1.*\bdeleted\b/);
    expect(markdown.toLowerCase()).not.toMatch(/act_review_1.*\bcleaned\b/);

    expect(
      report.retainedRecordsWithReasons.some((row) => row.actionId === "act_review_1"),
    ).toBe(false);
    expect(report.retainedRecordsWithReasons.every((row) => row.actionId === "act_retain_pay")).toBe(
      true,
    );

    expect(markdown).toContain(`**Records found before cleanup:** ${report.recordsFoundBefore}`);
    expect(markdown).toContain(
      `**Records remaining after live re-scan:** ${report.recordsRemainingAfter}`,
    );
    expect(json).toContain(`"recordsFoundBefore": ${report.recordsFoundBefore}`);
    expect(json).toContain(`"recordsRemainingAfter": ${report.recordsRemainingAfter}`);
  });

  it("lists blocked policies for approval, table-wide, payment, and unapproved execution", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers"],
      recordsFoundBefore: 1,
      plan: planWithReview,
      approval: {
        approvalId: "approval_blocked",
        approvedActionIds: [],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: [],
      recordsRemainingAfter: 0,
    });

    const policies = report.blockedActions.map((row) => row.policy.toLowerCase());
    const markdown = formatAuditReportMarkdown(report).toLowerCase();

    expect(policies.some((p) => p.includes("without") && p.includes("approval"))).toBe(true);
    expect(policies.some((p) => p.includes("table-wide"))).toBe(true);
    expect(policies.some((p) => p.includes("payments_transactions"))).toBe(true);
    expect(policies.some((p) => p.includes("unapproved"))).toBe(true);
    expect(markdown).toContain("no deletion or anonymization on payments_transactions");
  });

  it("does not describe payment records as delete or anonymize", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["payments_transactions"],
      recordsFoundBefore: 3,
      plan: planWithReview,
      approval: {
        approvalId: "approval_pay",
        approvedActionIds: ["act_retain_pay"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_retain_pay"],
      recordsRemainingAfter: 3,
    });

    const markdown = formatAuditReportMarkdown(report);
    const paymentLines = markdown
      .split("\n")
      .filter((line) => line.includes("payments_transactions"));

    expect(paymentLines.some((line) => line.includes("**retain**"))).toBe(true);
    expect(paymentLines.some((line) => line.includes("**delete**"))).toBe(false);
    expect(paymentLines.some((line) => line.includes("**anonymize**"))).toBe(false);
  });

  it("uses softened verification wording without legal-proof language", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers"],
      recordsFoundBefore: 10,
      plan: planWithReview,
      approval: {
        approvalId: "approval_verify",
        approvedActionIds: ["act_delete_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_delete_1"],
      recordsRemainingAfter: 8,
    });

    const markdown = formatAuditReportMarkdown(report);

    expect(report.verificationResult.statusLabel).toBe("Post-execution re-scan completed");
    expect(markdown).toContain("Post-execution re-scan");
    expect(markdown.toLowerCase()).not.toContain("verification: passed");
    expect(markdown.toLowerCase()).not.toContain("legally proven");
    expect(report.verificationResult.message.toLowerCase()).toContain("re-scan completed");
  });

  it("exports markdown and json formats", () => {
    const report = generateAuditReport({
      subject: demoSubject,
      connectors: sampleConnectors,
      warehouseTablesScanned: ["crm_customers"],
      recordsFoundBefore: 2,
      plan: samplePlan,
      approval: {
        approvalId: "approval_fmt",
        approvedActionIds: ["act_delete_1"],
        approvedBy: "demo-reviewer",
        approvedAt: "2026-06-02T10:05:00.000Z",
      },
      executedActionIds: ["act_delete_1"],
      recordsRemainingAfter: 1,
    });

    expect(formatAuditReportJson(report)).toContain('"requestType": "consent_withdrawal"');
    expect(formatAuditReportMarkdown(report)).toContain("# ConsentOps Demo Audit Report");
    expect(formatAuditReportMarkdown(report)).toContain("## Blocked by policy");
  });
});
