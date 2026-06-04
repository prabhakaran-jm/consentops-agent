import { MATCH_FIELDS } from "@/lib/warehouse/types";
import type {
  ConsentSubject,
  DataMatch,
  MatchConfidence,
  MatchField,
  SuggestedSensitivity,
  WarehouseRecord,
  WarehouseTable,
  WarehouseTableName,
} from "@/lib/warehouse/types";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const inferConfidence = (matchedFields: MatchField[]): MatchConfidence => {
  if (matchedFields.includes(MATCH_FIELDS.customerId)) return "high";
  if (
    matchedFields.includes(MATCH_FIELDS.email) ||
    matchedFields.includes(MATCH_FIELDS.phone)
  ) {
    return "high";
  }
  if (matchedFields.includes(MATCH_FIELDS.emailSha256)) return "medium";
  return "low";
};

export const inferSensitivity = (
  table: WarehouseTableName,
  matchedFields: MatchField[],
): SuggestedSensitivity => {
  if (table === "payments_transactions") return "transaction_record";
  if (
    matchedFields.includes(MATCH_FIELDS.emailSha256) &&
    !matchedFields.includes(MATCH_FIELDS.email) &&
    !matchedFields.includes(MATCH_FIELDS.phone)
  ) {
    return "derived_identifier";
  }
  if (matchedFields.length > 0) return "direct_identifier";
  return "free_text";
};

export const getMatchedFields = (subject: ConsentSubject, record: WarehouseRecord): MatchField[] => {
  const fields: MatchField[] = [];
  const recordEmail = record[MATCH_FIELDS.email];
  const recordPhone = record[MATCH_FIELDS.phone];
  const recordCustomerId = record[MATCH_FIELDS.customerId];
  const recordEmailSha256 = record[MATCH_FIELDS.emailSha256];

  const subjectEmail = hasNonEmptyString(subject.email) ? normalizeEmail(subject.email) : undefined;
  const subjectPhone = hasNonEmptyString(subject.phone) ? subject.phone : undefined;
  const subjectCustomerId = hasNonEmptyString(subject.customerId) ? subject.customerId : undefined;
  const subjectEmailSha256 = hasNonEmptyString(subject.emailSha256)
    ? subject.emailSha256
    : undefined;

  if (
    subjectEmail &&
    hasNonEmptyString(recordEmail) &&
    normalizeEmail(recordEmail) === subjectEmail
  ) {
    fields.push(MATCH_FIELDS.email);
  }

  if (subjectPhone && hasNonEmptyString(recordPhone) && recordPhone === subjectPhone) {
    fields.push(MATCH_FIELDS.phone);
  }

  if (
    subjectCustomerId &&
    hasNonEmptyString(recordCustomerId) &&
    recordCustomerId === subjectCustomerId
  ) {
    fields.push(MATCH_FIELDS.customerId);
  }

  if (
    subjectEmailSha256 &&
    hasNonEmptyString(recordEmailSha256) &&
    recordEmailSha256 === subjectEmailSha256
  ) {
    fields.push(MATCH_FIELDS.emailSha256);
  }

  return fields;
};

export const recordToMatch = (
  table: WarehouseTableName,
  record: WarehouseRecord,
  subject: ConsentSubject,
): DataMatch | null => {
  const matchedFields = getMatchedFields(subject, record);
  if (matchedFields.length === 0) return null;

  return {
    table,
    recordId: record.id,
    matchedFields,
    confidence: inferConfidence(matchedFields),
    suggestedSensitivity: inferSensitivity(table, matchedFields),
  };
};

export const scanSubjectAcrossWarehouse = (
  subject: ConsentSubject,
  tables: WarehouseTable[],
): DataMatch[] => {
  return tables.flatMap((table) =>
    table.records.flatMap((record) => {
      const match = recordToMatch(table.name, record, subject);
      return match ? [match] : [];
    }),
  );
};
