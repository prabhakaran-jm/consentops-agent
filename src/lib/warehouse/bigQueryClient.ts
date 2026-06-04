import type { BigQueryWarehouseConfig } from "@/lib/warehouse/bigQueryWarehouse";
import type { ConsentSubject } from "@/lib/warehouse/types";

export type BigQueryQueryResult = {
  rows: Record<string, unknown>[];
  bytesProcessed?: number;
};

export type BigQueryQueryRunner = {
  query(input: {
    sql: string;
    params?: Record<string, unknown>;
    dryRun?: boolean;
  }): Promise<BigQueryQueryResult>;
};

export const qualifyTable = (
  config: BigQueryWarehouseConfig,
  tableName: string,
): string => `\`${config.projectId}.${config.dataset}.${tableName}\``;

export const buildSubjectScanSql = (
  config: BigQueryWarehouseConfig,
  tableName: string,
  subject: ConsentSubject,
): { sql: string; params: Record<string, unknown> } => {
  const tableRef = qualifyTable(config, tableName);
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (subject.email.trim()) {
    clauses.push("LOWER(TRIM(email)) = @subjectEmail");
    params.subjectEmail = subject.email.trim().toLowerCase();
  }
  if (subject.phone.trim()) {
    clauses.push("phone = @subjectPhone");
    params.subjectPhone = subject.phone.trim();
  }
  if (subject.customerId.trim()) {
    clauses.push("customerId = @subjectCustomerId");
    params.subjectCustomerId = subject.customerId.trim();
  }
  if (subject.emailSha256.trim()) {
    clauses.push("emailSha256 = @subjectEmailSha256");
    params.subjectEmailSha256 = subject.emailSha256.trim();
  }

  if (clauses.length === 0) {
    return {
      sql: `SELECT id, email, phone, customerId, emailSha256 FROM ${tableRef} WHERE FALSE`,
      params: {},
    };
  }

  return {
    sql: `SELECT id, email, phone, customerId, emailSha256 FROM ${tableRef} WHERE ${clauses.join(" OR ")}`,
    params,
  };
};

export const createBigQueryRunner = (config: BigQueryWarehouseConfig): BigQueryQueryRunner => {
  // Lazy require keeps vitest from loading the SDK when tests inject a mock runner.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BigQuery } = require("@google-cloud/bigquery") as typeof import("@google-cloud/bigquery");
  const client = new BigQuery({ projectId: config.projectId });

  return {
    async query({ sql, params, dryRun }) {
      const [job] = await client.createQueryJob({
        query: sql,
        params,
        dryRun: dryRun ?? false,
      });

      if (dryRun) {
        const [metadata] = await job.getMetadata();
        const bytesProcessed = Number(metadata.statistics?.totalBytesProcessed ?? 0);
        return { rows: [], bytesProcessed };
      }

      const [rows] = await job.getQueryResults();
      return { rows: rows as Record<string, unknown>[] };
    },
  };
};
