import { MATCH_FIELDS } from "@/lib/warehouse/types";
import type {
  CleanupAction,
  ConsentSubject,
  DataMatch,
  MatchConfidence,
  MatchField,
  SuggestedSensitivity,
  WarehouseRecord,
  WarehouseTable,
  WarehouseTableName,
} from "@/lib/warehouse/types";

type DataSpreadMapEntry = {
  totalMatches: number;
  directIdentifierMatches: number;
  derivedIdentifierMatches: number;
  transactionRecordMatches: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
};

export type DataSpreadMap = Record<WarehouseTableName, DataSpreadMapEntry>;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const inferConfidence = (matchedFields: MatchField[]): MatchConfidence => {
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

const inferSensitivity = (
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

const getMatchedFields = (subject: ConsentSubject, record: WarehouseRecord): MatchField[] => {
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

  if (
    subjectPhone &&
    hasNonEmptyString(recordPhone) &&
    recordPhone === subjectPhone
  ) {
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

export const scanSubjectAcrossWarehouse = (
  subject: ConsentSubject,
  tables: WarehouseTable[],
): DataMatch[] => {
  return tables.flatMap((table) =>
    table.records.flatMap((record) => {
      const matchedFields = getMatchedFields(subject, record);
      if (matchedFields.length === 0) return [];

      return [
        {
          table: table.name,
          recordId: record.id,
          matchedFields,
          confidence: inferConfidence(matchedFields),
          suggestedSensitivity: inferSensitivity(table.name, matchedFields),
        },
      ];
    }),
  );
};

export const countMatchesByTable = (
  matches: DataMatch[],
): Partial<Record<WarehouseTableName, number>> => {
  return matches.reduce<Partial<Record<WarehouseTableName, number>>>((acc, match) => {
    acc[match.table] = (acc[match.table] ?? 0) + 1;
    return acc;
  }, {});
};

export const buildDataSpreadMap = (matches: DataMatch[]): Partial<DataSpreadMap> => {
  return matches.reduce<Partial<DataSpreadMap>>((acc, match) => {
    if (!acc[match.table]) {
      acc[match.table] = {
        totalMatches: 0,
        directIdentifierMatches: 0,
        derivedIdentifierMatches: 0,
        transactionRecordMatches: 0,
        highConfidenceMatches: 0,
        mediumConfidenceMatches: 0,
        lowConfidenceMatches: 0,
      };
    }

    const row = acc[match.table];
    if (!row) return acc;

    row.totalMatches += 1;

    if (match.suggestedSensitivity === "direct_identifier") row.directIdentifierMatches += 1;
    if (match.suggestedSensitivity === "derived_identifier") row.derivedIdentifierMatches += 1;
    if (match.suggestedSensitivity === "transaction_record") row.transactionRecordMatches += 1;

    if (match.confidence === "high") row.highConfidenceMatches += 1;
    if (match.confidence === "medium") row.mediumConfidenceMatches += 1;
    if (match.confidence === "low") row.lowConfidenceMatches += 1;

    return acc;
  }, {});
};

export const verifyNoUnclassifiedMatches = (
  matches: DataMatch[],
  cleanupActions: CleanupAction[],
): DataMatch[] => {
  const coveredRecordIds = new Set(cleanupActions.flatMap((action) => action.recordIds));
  return matches.filter((match) => !coveredRecordIds.has(match.recordId));
};
