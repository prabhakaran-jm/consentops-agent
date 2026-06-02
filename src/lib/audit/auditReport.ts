import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";
import type { ExecutionApproval } from "@/lib/execution/safetyPolicy";
import type {
  CleanupAction,
  CleanupPlan,
  ConsentSubject,
  WarehouseTableName,
} from "@/lib/warehouse/types";

export const AUDIT_DISCLAIMER =
  "This is a hackathon demo audit report for synthetic data only. It is not legal advice and does not certify regulatory compliance.";

export const LIVE_RESCAN_NOTE =
  "After cleanup, ConsentOps re-scans the demo warehouse instead of trusting a self-reported count.";

export const DEMO_BLOCKED_ACTION_POLICIES = [
  "No cleanup execution without explicit human approval.",
  "No table-wide deletion or wildcard record targeting.",
  "No deletion or anonymization on payments_transactions (retain-only).",
  "No unapproved action may be executed.",
] as const;

export type ConsentRequestType = "consent_withdrawal";

export interface ConnectorInspectedSummary {
  id: string;
  name: string;
  health: string;
  lastSyncedAtIso: string;
  mappedTables: WarehouseTableName[];
}

export interface RetainedRecordWithReason {
  actionId: string;
  table: WarehouseTableName;
  recordIds: string[];
  reason: string;
}

export interface BlockedActionPolicy {
  policy: string;
}

export interface VerificationResult {
  /** Internal flag for demo logic only — not shown as "passed/failed" in user-facing text. */
  passed: boolean;
  statusLabel: string;
  message: string;
  recordsFoundOnLiveRescan: number;
  noMatchGrowth: boolean;
}

export interface AuditApprovalInfo {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  approvedActionIds: string[];
}

export interface ConsentOpsAuditReport {
  id: string;
  requestId: string;
  requestSubject: ConsentSubject;
  requestType: ConsentRequestType;
  connectorsInspected: ConnectorInspectedSummary[];
  warehouseTablesScanned: WarehouseTableName[];
  recordsFoundBefore: number;
  cleanupActionsProposed: CleanupAction[];
  actionsApproved: CleanupAction[];
  actionsExecuted: CleanupAction[];
  recordsRemainingAfter: number;
  retainedRecordsWithReasons: RetainedRecordWithReason[];
  blockedActions: BlockedActionPolicy[];
  approval: AuditApprovalInfo;
  verificationResult: VerificationResult;
  generatedAt: string;
  disclaimer: string;
  summary: string;
}

export interface GenerateAuditReportInput {
  subject: ConsentSubject;
  connectors: FivetranConnector[];
  warehouseTablesScanned: WarehouseTableName[];
  recordsFoundBefore: number;
  plan: CleanupPlan;
  approval: ExecutionApproval;
  executedActionIds: string[];
  recordsRemainingAfter: number;
  requestId?: string;
}

const retainReasonRequired = (action: CleanupAction): string => {
  if (action.classification !== "retain") return "";
  if (!action.retainReason?.trim()) {
    throw new Error(`Retain action '${action.id}' is missing a required reason.`);
  }
  return action.retainReason;
};

export const generateAuditReport = (input: GenerateAuditReportInput): ConsentOpsAuditReport => {
  const approvedSet = new Set(input.approval.approvedActionIds);
  const executedSet = new Set(input.executedActionIds);

  const actionsApproved = input.plan.actions.filter((action) => approvedSet.has(action.id));
  const actionsExecuted = input.plan.actions.filter((action) => executedSet.has(action.id));

  const retainedRecordsWithReasons: RetainedRecordWithReason[] = input.plan.actions
    .filter((action) => action.classification === "retain")
    .map((action) => ({
      actionId: action.id,
      table: action.table,
      recordIds: [...action.recordIds],
      reason: retainReasonRequired(action),
    }));

  const noMatchGrowth = input.recordsRemainingAfter <= input.recordsFoundBefore;

  const generatedAt = new Date().toISOString();
  const requestId = input.requestId ?? `req_${Date.now()}`;

  const report: ConsentOpsAuditReport = {
    id: `audit_${Date.now()}`,
    requestId,
    requestSubject: { ...input.subject },
    requestType: "consent_withdrawal",
    connectorsInspected: input.connectors.map((connector) => ({
      id: connector.id,
      name: connector.name,
      health: connector.health,
      lastSyncedAtIso: connector.lastSyncedAtIso,
      mappedTables: [...connector.mappedTables],
    })),
    warehouseTablesScanned: [...input.warehouseTablesScanned],
    recordsFoundBefore: input.recordsFoundBefore,
    cleanupActionsProposed: input.plan.actions.map((action) => ({
      ...action,
      recordIds: [...action.recordIds],
    })),
    actionsApproved: actionsApproved.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
    actionsExecuted: actionsExecuted.map((action) => ({ ...action, recordIds: [...action.recordIds] })),
    recordsRemainingAfter: input.recordsRemainingAfter,
    retainedRecordsWithReasons,
    blockedActions: DEMO_BLOCKED_ACTION_POLICIES.map((policy) => ({ policy })),
    approval: {
      approvalId: input.approval.approvalId,
      approvedBy: input.approval.approvedBy,
      approvedAt: input.approval.approvedAt,
      approvedActionIds: [...input.approval.approvedActionIds],
    },
    verificationResult: {
      passed: noMatchGrowth,
      statusLabel: "Post-execution re-scan completed",
      message: noMatchGrowth
        ? "Re-scan completed. No match growth after cleanup."
        : "Re-scan completed. Match count increased versus pre-cleanup scan — review demo state manually.",
      recordsFoundOnLiveRescan: input.recordsRemainingAfter,
      noMatchGrowth,
    },
    generatedAt,
    disclaimer: AUDIT_DISCLAIMER,
    summary: buildAuditSummary({
      subjectName: input.subject.fullName,
      recordsFoundBefore: input.recordsFoundBefore,
      recordsRemainingAfter: input.recordsRemainingAfter,
      actionsApprovedCount: actionsApproved.length,
      actionsExecutedCount: actionsExecuted.length,
      retainedCount: retainedRecordsWithReasons.length,
    }),
  };

  return report;
};

function buildAuditSummary(args: {
  subjectName: string;
  recordsFoundBefore: number;
  recordsRemainingAfter: number;
  actionsApprovedCount: number;
  actionsExecutedCount: number;
  retainedCount: number;
}): string {
  return (
    `Consent withdrawal demo for ${args.subjectName}: ${args.recordsFoundBefore} records found before cleanup, ` +
    `${args.actionsApprovedCount} actions approved, ${args.actionsExecutedCount} executed, ` +
    `${args.recordsRemainingAfter} records remaining after live re-scan, ${args.retainedCount} retain actions documented with reasons.`
  );
}

export const formatAuditReportJson = (report: ConsentOpsAuditReport): string =>
  JSON.stringify(report, null, 2);

export const formatAuditReportMarkdown = (report: ConsentOpsAuditReport): string => {
  const lines: string[] = [
    "# ConsentOps Demo Audit Report",
    "",
    `> ${report.disclaimer}`,
    "",
    "## Summary",
    report.summary,
    "",
    "## Request",
    `- **Subject:** ${report.requestSubject.fullName} (${report.requestSubject.customerId})`,
    `- **Email:** ${report.requestSubject.email}`,
    `- **Request type:** ${report.requestType}`,
    `- **Request ID:** ${report.requestId}`,
    `- **Generated at:** ${report.generatedAt}`,
    "",
    "## Approval",
    `- **Approval ID:** ${report.approval.approvalId}`,
    `- **Approved by:** ${report.approval.approvedBy}`,
    `- **Approved at:** ${report.approval.approvedAt}`,
    `- **Approved action IDs:** ${report.approval.approvedActionIds.join(", ") || "(none)"}`,
    "",
    "## Data movement (Fivetran connectors inspected)",
    ...report.connectorsInspected.map(
      (c) =>
        `- **${c.name}** (${c.health}) — last sync ${c.lastSyncedAtIso}; tables: ${c.mappedTables.join(", ")}`,
    ),
    "",
    "## Warehouse scan",
    `- **Tables scanned:** ${report.warehouseTablesScanned.join(", ")}`,
    `- **Records found before cleanup:** ${report.recordsFoundBefore}`,
    `- **Records remaining after live re-scan:** ${report.recordsRemainingAfter}`,
    "",
    "## Post-execution re-scan",
    LIVE_RESCAN_NOTE,
    `- **Status:** ${report.verificationResult.statusLabel}`,
    `- **Details:** ${report.verificationResult.message}`,
    report.verificationResult.noMatchGrowth
      ? "- **Match growth after cleanup:** none detected on live re-scan"
      : "- **Match growth after cleanup:** detected — manual review suggested",
  ];

  lines.push("", "## Cleanup actions proposed", `Total: ${report.cleanupActionsProposed.length}`);
  for (const action of report.cleanupActionsProposed) {
    lines.push(
      `- \`${action.id}\` **${action.classification}** — ${action.table} → ${action.recordIds.join(", ")}`,
    );
  }

  lines.push("", "## Actions approved", `Total: ${report.actionsApproved.length}`);
  for (const action of report.actionsApproved) {
    lines.push(`- \`${action.id}\` **${action.classification}** — ${action.recordIds.join(", ")}`);
  }

  lines.push("", "## Actions executed", `Total: ${report.actionsExecuted.length}`);
  for (const action of report.actionsExecuted) {
    lines.push(`- \`${action.id}\` **${action.classification}** — ${action.recordIds.join(", ")}`);
  }

  lines.push("", "## Retained records (with reasons)");
  if (report.retainedRecordsWithReasons.length === 0) {
    lines.push("- (none)");
  } else {
    for (const row of report.retainedRecordsWithReasons) {
      lines.push(`- \`${row.actionId}\` ${row.table} → ${row.recordIds.join(", ")} — **${row.reason}**`);
    }
  }

  lines.push("", "## Blocked by policy (not executed automatically)");
  for (const blocked of report.blockedActions) {
    lines.push(`- ${blocked.policy}`);
  }

  return lines.join("\n");
};
