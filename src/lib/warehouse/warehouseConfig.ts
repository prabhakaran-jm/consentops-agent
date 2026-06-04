import type { WarehouseTableName } from "@/lib/warehouse/types";

export type WarehouseMode = "local_json" | "bigquery_scan" | "bigquery_full";

export const WAREHOUSE_TABLE_NAMES: WarehouseTableName[] = [
  "crm_customers",
  "commerce_orders",
  "support_tickets",
  "marketing_email_events",
  "analytics_customer_360",
  "ai_training_feedback_export",
  "payments_transactions",
];

export const getWarehouseModeFromEnv = (): WarehouseMode => {
  const raw = process.env.CONSENTOPS_WAREHOUSE_MODE?.trim().toLowerCase();
  if (raw === "bigquery_scan" || raw === "bigquery-scan") return "bigquery_scan";
  if (raw === "bigquery_full" || raw === "bigquery-full") return "bigquery_full";
  return "local_json";
};
