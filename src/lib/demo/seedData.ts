import { createHash } from "node:crypto";

import type {
  AuditReport,
  CleanupAction,
  CleanupPlan,
  ConnectorStatus,
  ConsentSubject,
  MatchField,
  WarehouseRecord,
  WarehouseTable,
  WarehouseTableName,
} from "@/lib/warehouse/types";
import { MATCH_FIELDS } from "@/lib/warehouse/types";

export const getEmailSha256 = (email: string): string =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

export const demoSubject: ConsentSubject = {
  id: "subj_ana_reyes",
  fullName: "Ana Reyes",
  email: "ana.reyes@example.com",
  phone: "+1-555-0188",
  customerId: "cus_1029",
  emailSha256: getEmailSha256("ana.reyes@example.com"),
};

const record = (
  table: WarehouseTableName,
  id: string,
  overrides: Record<string, unknown> = {},
): WarehouseRecord => ({
  id: `${table}_${id}`,
  ...overrides,
});

export const demoWarehouseTables: WarehouseTable[] = [
  {
    name: "crm_customers",
    records: [
      record("crm_customers", "001", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        phone: demoSubject.phone,
        fullName: demoSubject.fullName,
      }),
      record("crm_customers", "002", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        lifecycleStage: "active",
      }),
      record("crm_customers", "003", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        marketingOptIn: true,
      }),
      record("crm_customers", "100", {
        customerId: "cus_7001",
        email: "other.customer@example.com",
      }),
    ],
  },
  {
    name: "commerce_orders",
    records: [
      record("commerce_orders", "001", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        orderTotal: 129.99,
      }),
      record("commerce_orders", "002", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        orderTotal: 49.5,
      }),
      record("commerce_orders", "003", {
        customerId: demoSubject.customerId,
        phone: demoSubject.phone,
        orderTotal: 88,
      }),
      record("commerce_orders", "004", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        orderTotal: 15.75,
      }),
      record("commerce_orders", "005", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        orderTotal: 210.1,
      }),
      record("commerce_orders", "006", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        orderTotal: 31.0,
      }),
      record("commerce_orders", "100", {
        customerId: "cus_7002",
        email: "retail.demo@example.com",
      }),
    ],
  },
  {
    name: "support_tickets",
    records: [
      record("support_tickets", "001", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        subject: "Refund request",
      }),
      record("support_tickets", "002", {
        customerId: demoSubject.customerId,
        phone: demoSubject.phone,
        subject: "Login issue",
      }),
      record("support_tickets", "003", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        subject: "Address change",
      }),
      record("support_tickets", "004", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        subject: "Invoice copy",
      }),
      record("support_tickets", "005", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        subject: "Shipping delay",
      }),
      record("support_tickets", "100", {
        customerId: "cus_7003",
        email: "unrelated.support@example.com",
      }),
    ],
  },
  {
    name: "marketing_email_events",
    records: [
      record("marketing_email_events", "001", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "open",
      }),
      record("marketing_email_events", "002", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "click",
      }),
      record("marketing_email_events", "003", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "open",
      }),
      record("marketing_email_events", "004", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "bounce",
      }),
      record("marketing_email_events", "005", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "unsubscribe",
      }),
      record("marketing_email_events", "006", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        event: "open",
      }),
      record("marketing_email_events", "100", {
        customerId: "cus_7004",
        email: "marketing.other@example.com",
      }),
    ],
  },
  {
    name: "analytics_customer_360",
    records: [
      record("analytics_customer_360", "001", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.11,
      }),
      record("analytics_customer_360", "002", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.19,
      }),
      record("analytics_customer_360", "003", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.27,
      }),
      record("analytics_customer_360", "004", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.34,
      }),
      record("analytics_customer_360", "005", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.42,
      }),
      record("analytics_customer_360", "006", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.5,
      }),
      record("analytics_customer_360", "007", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        riskScore: 0.57,
      }),
      record("analytics_customer_360", "100", {
        customerId: "cus_7005",
        emailSha256: getEmailSha256("someone.else@example.com"),
      }),
    ],
  },
  {
    name: "ai_training_feedback_export",
    records: [
      record("ai_training_feedback_export", "001", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 4,
      }),
      record("ai_training_feedback_export", "002", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 5,
      }),
      record("ai_training_feedback_export", "003", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 3,
      }),
      record("ai_training_feedback_export", "004", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 4,
      }),
      record("ai_training_feedback_export", "005", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 2,
      }),
      record("ai_training_feedback_export", "006", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 5,
      }),
      record("ai_training_feedback_export", "007", {
        customerId: demoSubject.customerId,
        emailSha256: demoSubject.emailSha256,
        feedbackScore: 4,
      }),
      record("ai_training_feedback_export", "100", {
        customerId: "cus_7006",
        emailSha256: getEmailSha256("feedback.other@example.com"),
      }),
    ],
  },
  {
    name: "payments_transactions",
    records: [
      record("payments_transactions", "001", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        amount: 95.0,
      }),
      record("payments_transactions", "002", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        amount: 120.0,
      }),
      record("payments_transactions", "003", {
        customerId: demoSubject.customerId,
        email: demoSubject.email,
        amount: 15.0,
      }),
      record("payments_transactions", "100", {
        customerId: "cus_7007",
        email: "payments.other@example.com",
      }),
    ],
  },
];

const getMatchedFieldsForRecord = (record: WarehouseRecord): MatchField[] => {
  const fields: MatchField[] = [];
  if (record[MATCH_FIELDS.email] === demoSubject.email) fields.push(MATCH_FIELDS.email);
  if (record[MATCH_FIELDS.phone] === demoSubject.phone) fields.push(MATCH_FIELDS.phone);
  if (record[MATCH_FIELDS.customerId] === demoSubject.customerId) {
    fields.push(MATCH_FIELDS.customerId);
  }
  if (record[MATCH_FIELDS.emailSha256] === demoSubject.emailSha256) {
    fields.push(MATCH_FIELDS.emailSha256);
  }
  return fields;
};

export const demoMatchedRecords = demoWarehouseTables.flatMap((table) =>
  table.records
    .map((currentRecord) => ({
      table: table.name,
      record: currentRecord,
      matchedFields: getMatchedFieldsForRecord(currentRecord),
    }))
    .filter((entry) => entry.matchedFields.length > 0),
);

export const connectorStatuses: ConnectorStatus[] = [
  {
    connectorId: "conn_hubspot_demo",
    connectorName: "HubSpot CRM",
    sourceSystem: "hubspot",
    destination: "local_json_warehouse",
    health: "healthy",
    syncedAtIso: "2026-06-02T08:00:00.000Z",
  },
  {
    connectorId: "conn_shopify_demo",
    connectorName: "Shopify Orders",
    sourceSystem: "shopify",
    destination: "local_json_warehouse",
    health: "healthy",
    syncedAtIso: "2026-06-02T08:01:30.000Z",
  },
  {
    connectorId: "conn_zendesk_demo",
    connectorName: "Zendesk Support",
    sourceSystem: "zendesk",
    destination: "local_json_warehouse",
    health: "degraded",
    syncedAtIso: "2026-06-02T07:58:10.000Z",
  },
];

const reviewRecordIds = new Set<string>([
  "ai_training_feedback_export_007",
  "support_tickets_005",
]);

const anonymizeTables = new Set<WarehouseTableName>([
  "marketing_email_events",
  "analytics_customer_360",
  "ai_training_feedback_export",
]);

const actionForMatchedRecord = (
  match: (typeof demoMatchedRecords)[number],
  index: number,
): CleanupAction => {
  const recordId = match.record.id;
  const table = match.table;

  if (table === "payments_transactions") {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "retain",
      fields: [...match.matchedFields, "amount"],
      retainReason: "Financial retention review required",
    };
  }

  if (reviewRecordIds.has(recordId)) {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "review",
      fields: match.matchedFields,
    };
  }

  if (anonymizeTables.has(table)) {
    return {
      id: `act_${String(index + 1).padStart(3, "0")}`,
      table,
      recordIds: [recordId],
      classification: "anonymize",
      fields: match.matchedFields,
    };
  }

  return {
    id: `act_${String(index + 1).padStart(3, "0")}`,
    table,
    recordIds: [recordId],
    classification: "delete",
    fields: match.matchedFields,
  };
};

const allCleanupActions: CleanupAction[] = demoMatchedRecords.map(actionForMatchedRecord);
const retainedActions = allCleanupActions.filter((action) => action.classification === "retain");
const reviewActions = allCleanupActions.filter((action) => action.classification === "review");
export const retainedPaymentActions = retainedActions.filter(
  (action) => action.table === "payments_transactions",
);

export const demoCleanupPlan: CleanupPlan = {
  id: "plan_ana_20260602",
  subjectId: demoSubject.id,
  createdAtIso: "2026-06-02T08:05:00.000Z",
  totalMatchesBeforeCleanup: demoMatchedRecords.length,
  actions: allCleanupActions,
};

export const demoAuditReport: AuditReport = {
  id: "audit_ana_20260602",
  requestId: "req_ana_withdrawal_001",
  subjectId: demoSubject.id,
  generatedAtIso: "2026-06-02T08:15:00.000Z",
  approvedBy: "demo.operator@consentops.local",
  totalMatchesBeforeCleanup: demoCleanupPlan.totalMatchesBeforeCleanup,
  remainingMatchesAfterCleanup: retainedActions.length + reviewActions.length,
  retainedRecords: retainedActions,
  notes:
    "Matched records were assigned delete, anonymize, retain, or review actions. Retained and review records remain with reasons.",
};
