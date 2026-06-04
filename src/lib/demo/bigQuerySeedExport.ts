import { getEmailSha256 } from "@/lib/demo/seedData";
import type { WarehouseRecord, WarehouseTable, WarehouseTableName } from "@/lib/warehouse/types";

export type BigQueryColumnType = "STRING" | "FLOAT64";

export type BigQueryTableSchema = {
  table: WarehouseTableName;
  fields: { name: string; type: BigQueryColumnType }[];
};

/** Columns aligned with scripts/bigquery/demo-schema.sql and BigQueryWarehouseAdapter scan. */
export const DEMO_BIGQUERY_TABLE_SCHEMAS: BigQueryTableSchema[] = [
  {
    table: "crm_customers",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "fullName", type: "STRING" },
    ],
  },
  {
    table: "commerce_orders",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "orderTotal", type: "FLOAT64" },
    ],
  },
  {
    table: "support_tickets",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "subject", type: "STRING" },
    ],
  },
  {
    table: "marketing_email_events",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "campaign", type: "STRING" },
    ],
  },
  {
    table: "analytics_customer_360",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "segment", type: "STRING" },
    ],
  },
  {
    table: "ai_training_feedback_export",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "feedbackType", type: "STRING" },
    ],
  },
  {
    table: "payments_transactions",
    fields: [
      { name: "id", type: "STRING" },
      { name: "email", type: "STRING" },
      { name: "phone", type: "STRING" },
      { name: "customerId", type: "STRING" },
      { name: "emailSha256", type: "STRING" },
      { name: "amount", type: "FLOAT64" },
    ],
  },
];

const schemaByTable = new Map(
  DEMO_BIGQUERY_TABLE_SCHEMAS.map((schema) => [schema.table, schema]),
);

const readString = (record: WarehouseRecord, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const readNumber = (record: WarehouseRecord, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

/** Map local fixture fields to BigQuery column names (synthetic demo only). */
export const mapRecordToBigQueryRow = (
  table: WarehouseTableName,
  record: WarehouseRecord,
): Record<string, string | number | null> => {
  const schema = schemaByTable.get(table);
  if (!schema) {
    throw new Error(`No BigQuery schema for table '${table}'.`);
  }

  const email = readString(record, "email");
  const emailSha256 =
    readString(record, "emailSha256") ?? (email ? getEmailSha256(email) : undefined);

  const derived: Record<string, string | number | undefined> = {
    id: record.id,
    email,
    phone: readString(record, "phone"),
    customerId: readString(record, "customerId"),
    emailSha256,
    fullName: readString(record, "fullName"),
    orderTotal: readNumber(record, "orderTotal"),
    subject: readString(record, "subject"),
    campaign: readString(record, "campaign") ?? readString(record, "event"),
    segment:
      readString(record, "segment") ??
      (readNumber(record, "riskScore") !== undefined
        ? `risk_${readNumber(record, "riskScore")}`
        : undefined),
    feedbackType:
      readString(record, "feedbackType") ??
      (readNumber(record, "feedbackScore") !== undefined
        ? `score_${readNumber(record, "feedbackScore")}`
        : undefined),
    amount: readNumber(record, "amount"),
  };

  const row: Record<string, string | number | null> = {};
  for (const field of schema.fields) {
    const value = derived[field.name];
    row[field.name] = value === undefined ? null : value;
  }
  return row;
};

export const mapWarehouseTablesToBigQueryRows = (
  tables: WarehouseTable[],
): Record<WarehouseTableName, Record<string, string | number | null>[]> => {
  const output = {} as Record<WarehouseTableName, Record<string, string | number | null>[]>;

  for (const table of tables) {
    output[table.name] = table.records.map((record) => mapRecordToBigQueryRow(table.name, record));
  }

  return output;
};

export const countBigQuerySeedRows = (tables: WarehouseTable[]): number =>
  tables.reduce((sum, table) => sum + table.records.length, 0);
