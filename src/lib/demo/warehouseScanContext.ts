import type { PipelineLineageEntry } from "@/lib/connectors/fivetranPipelineDiscovery";
import { DEMO_ANA_REYES_FIXTURE_MATCH_COUNT } from "@/lib/demo/seedData";
import { getBigQueryConfigFromEnv } from "@/lib/warehouse/bigQueryWarehouse";
import { getWarehouseModeFromEnv } from "@/lib/warehouse/warehouseConfig";

export type WarehouseScanContext = {
  scanSource: "local_json" | "bigquery";
  warehouseMode: string;
  bigQueryProject: string | null;
  bigQueryDataset: string | null;
  fivetranPrimaryConnector: string | null;
  fivetranDestinationType: string | null;
  fixtureMatchCount: number;
  note: string;
};

export const buildWarehouseScanContext = (
  scanSource: "local_json" | "bigquery",
  pipelineLineage: PipelineLineageEntry[],
): WarehouseScanContext => {
  const bigQueryConfig = getBigQueryConfigFromEnv();
  const primary =
    pipelineLineage.find((entry) => entry.service.toLowerCase().includes("bigquery")) ??
    pipelineLineage[0];

  return {
    scanSource,
    warehouseMode: getWarehouseModeFromEnv(),
    bigQueryProject: bigQueryConfig?.projectId ?? null,
    bigQueryDataset: bigQueryConfig?.dataset ?? null,
    fivetranPrimaryConnector: primary?.connectorAlias ?? null,
    fivetranDestinationType: primary?.service.toLowerCase().includes("bigquery") ? "bigquery" : null,
    fixtureMatchCount: DEMO_ANA_REYES_FIXTURE_MATCH_COUNT,
    note:
      "Use scan.beforeCount as the live match count. After npm run bigquery:setup, Ana Reyes fixtures expect 37 matches when all seven demo tables are loaded.",
  };
};
