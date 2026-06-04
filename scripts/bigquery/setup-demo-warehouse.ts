/**
 * Provision synthetic ConsentOps demo tables in BigQuery from src/lib/demo/seedData.ts.
 *
 * Usage:
 *   npm run bigquery:setup
 *   npm run bigquery:setup -- --dry-run
 *
 * Reads GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET from .env.local / .env (or env vars).
 * Auth: Application Default Credentials (gcloud auth application-default login).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BigQuery } from "@google-cloud/bigquery";

import {
  countBigQuerySeedRows,
  DEMO_BIGQUERY_TABLE_SCHEMAS,
  mapWarehouseTablesToBigQueryRows,
} from "@/lib/demo/bigQuerySeedExport";
import { demoWarehouseTables } from "@/lib/demo/seedData";

type SetupOptions = {
  projectId: string;
  datasetId: string;
  location: string;
  dryRun: boolean;
};

const loadEnvFiles = (): void => {
  const root = resolve(process.cwd());
  for (const name of [".env.local", ".env"]) {
    const filePath = resolve(root, name);
    if (!existsSync(filePath)) continue;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
};

const parseArgs = (): SetupOptions => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const locationArg = args.find((arg) => arg.startsWith("--location="));
  const location = locationArg?.split("=")[1] ?? "US";

  loadEnvFiles();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ??
    process.env.BIGQUERY_PROJECT_ID?.trim() ??
    "";
  const datasetId = process.env.BIGQUERY_DATASET?.trim() ?? "";

  if (!projectId || !datasetId) {
    throw new Error(
      "Set GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET in .env.local (or pass via environment).",
    );
  }

  return { projectId, datasetId, location, dryRun };
};

const ensureDataset = async (client: BigQuery, options: SetupOptions): Promise<void> => {
  const dataset = client.dataset(options.datasetId);
  const [exists] = await dataset.exists();
  if (exists) {
    console.log(`Dataset ${options.projectId}:${options.datasetId} already exists.`);
    return;
  }

  if (options.dryRun) {
    console.log(`[dry-run] Would create dataset ${options.projectId}:${options.datasetId}`);
    return;
  }

  await client.createDataset(options.datasetId, { location: options.location });
  console.log(`Created dataset ${options.projectId}:${options.datasetId} (${options.location}).`);
};

const ensureTable = async (
  client: BigQuery,
  options: SetupOptions,
  tableId: string,
  schema: { name: string; type: string }[],
): Promise<void> => {
  const table = client.dataset(options.datasetId).table(tableId);
  const [exists] = await table.exists();

  if (!exists) {
    if (options.dryRun) {
      console.log(`[dry-run] Would create table ${tableId}`);
      return;
    }
    await table.create({
      schema: schema.map((field) => ({ name: field.name, type: field.type })),
    });
    console.log(`Created table ${tableId}.`);
    return;
  }

  if (options.dryRun) {
    console.log(`[dry-run] Table ${tableId} exists — would truncate and reload.`);
    return;
  }

  await client.query({
    query: `TRUNCATE TABLE \`${options.projectId}.${options.datasetId}.${tableId}\``,
  });
  console.log(`Truncated table ${tableId}.`);
};

const insertRows = async (
  client: BigQuery,
  options: SetupOptions,
  tableId: string,
  rows: Record<string, string | number | null>[],
): Promise<void> => {
  if (rows.length === 0) return;

  if (options.dryRun) {
    console.log(`[dry-run] Would insert ${rows.length} rows into ${tableId}.`);
    return;
  }

  const table = client.dataset(options.datasetId).table(tableId);
  await table.insert(rows);
  console.log(`Inserted ${rows.length} rows into ${tableId}.`);
};

const main = async (): Promise<void> => {
  const options = parseArgs();
  const rowSets = mapWarehouseTablesToBigQueryRows(demoWarehouseTables);
  const totalRows = countBigQuerySeedRows(demoWarehouseTables);

  console.log(
    `ConsentOps BigQuery setup — project=${options.projectId} dataset=${options.datasetId} rows=${totalRows}${options.dryRun ? " (dry-run)" : ""}`,
  );

  const client = new BigQuery({ projectId: options.projectId });
  await ensureDataset(client, options);

  for (const tableSchema of DEMO_BIGQUERY_TABLE_SCHEMAS) {
    const tableId = tableSchema.table;
    await ensureTable(client, options, tableId, tableSchema.fields);
    await insertRows(client, options, tableId, rowSets[tableId] ?? []);
  }

  console.log("Done. Set CONSENTOPS_WAREHOUSE_MODE=bigquery_scan or bigquery_full and restart the app.");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`BigQuery setup failed: ${message}`);
  process.exitCode = 1;
});
