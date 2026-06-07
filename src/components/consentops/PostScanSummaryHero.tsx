import { ArrowUpRight, Bot, Database, Workflow } from "lucide-react";

import { AGENT_ENGINE_PLAYGROUND_URL } from "@/lib/demo/publicLinks";
import type { PlatformStatus } from "@/lib/platform/platformStatus";

import type { ScanResponse } from "./types";
import { Badge } from "./ui";

type Props = {
  scan: ScanResponse;
  platformStatus: PlatformStatus | null;
};

export function PostScanSummaryHero({ scan, platformStatus }: Props) {
  const connectorCount = scan.fivetran.connectionCount;
  const warehouseLabel =
    platformStatus?.adapters.warehouseScanSource === "bigquery" ? "BigQuery" : "Local JSON";

  return (
    <section
      aria-label="Scan summary"
      className="rounded-lg border border-cops-secondary-container/40 bg-gradient-to-br from-cops-surface-container-low to-cops-surface-container-lowest p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cops-secondary">
            Discovery complete
          </p>
          <h2 className="mt-1 text-xl font-semibold text-cops-primary">
            {scan.beforeCount} record{scan.beforeCount === 1 ? "" : "s"} found for {scan.subject.fullName}
          </h2>
          <p className="mt-1 text-[13px] text-cops-on-surface-variant">
            Fivetran MCP discovery and warehouse scan finished. Generate a cleanup plan next.
          </p>
        </div>
        <a
          href={AGENT_ENGINE_PLAYGROUND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cops-secondary px-4 py-2.5 text-[13px] font-medium text-cops-on-secondary shadow-sm transition-colors hover:bg-[#00547a]"
        >
          <Bot className="h-4 w-4" aria-hidden />
          Agent Engine playground
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-3">
          <p className="flex items-center gap-1 font-mono text-[10px] uppercase text-cops-outline">
            <Database className="h-3 w-3" aria-hidden />
            Records
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-cops-primary">{scan.beforeCount}</p>
        </div>
        <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-3">
          <p className="flex items-center gap-1 font-mono text-[10px] uppercase text-cops-outline">
            <Workflow className="h-3 w-3" aria-hidden />
            MCP tools
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-cops-primary">{scan.mcpToolsRun}</p>
        </div>
        <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-3">
          <p className="font-mono text-[10px] uppercase text-cops-outline">Connectors</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-cops-primary">{connectorCount}</p>
        </div>
        <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-3">
          <p className="font-mono text-[10px] uppercase text-cops-outline">Warehouse</p>
          <p className="mt-2">
            <Badge tone="info">{warehouseLabel}</Badge>
          </p>
          {scan.fivetranDiscoverySource && (
            <p className="mt-2">
              <Badge tone="neutral">{scan.fivetranDiscoverySource}</Badge>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
