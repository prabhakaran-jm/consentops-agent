export type WarehouseTableName =
  | "crm_customers"
  | "commerce_orders"
  | "support_tickets"
  | "marketing_email_events"
  | "analytics_customer_360"
  | "ai_training_feedback_export"
  | "payments_transactions";

export interface ConsentSubject {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  customerId: string;
  emailSha256: string;
}

export interface WarehouseRecord {
  id: string;
  email?: string;
  phone?: string;
  customerId?: string;
  emailSha256?: string;
  [key: string]: unknown;
}

export interface WarehouseTable {
  name: WarehouseTableName;
  records: WarehouseRecord[];
}

export type MatchField = "email" | "phone" | "customerId" | "emailSha256";

export interface DataMatch {
  table: WarehouseTableName;
  recordId: string;
  matchedFields: MatchField[];
}

export type ConnectorHealth = "healthy" | "degraded" | "offline";

export interface ConnectorStatus {
  connectorId: string;
  connectorName: string;
  sourceSystem: string;
  destination: string;
  health: ConnectorHealth;
  syncedAtIso: string;
}

export type CleanupClassification = "delete" | "anonymize" | "retain" | "review";

export interface CleanupAction {
  id: string;
  table: WarehouseTableName;
  recordId: string;
  classification: CleanupClassification;
  fields: string[];
  retainReason?: string;
}

export interface CleanupPlan {
  id: string;
  subjectId: string;
  createdAtIso: string;
  totalMatchesBeforeCleanup: number;
  actions: CleanupAction[];
}

export interface AuditReport {
  id: string;
  requestId: string;
  subjectId: string;
  generatedAtIso: string;
  approvedBy: string;
  totalMatchesBeforeCleanup: number;
  remainingMatchesAfterCleanup: number;
  retainedRecords: CleanupAction[];
  notes: string;
}
