import type { CleanupAction, DataMatch, WarehouseTableName } from "@/lib/warehouse/types";

export {
  getMatchedFields,
  inferConfidence,
  inferSensitivity,
  scanSubjectAcrossWarehouse,
} from "@/lib/warehouse/matchEngine";

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
