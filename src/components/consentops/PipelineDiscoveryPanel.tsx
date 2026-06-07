import { CheckCircle2, CircleDashed, GitBranch, Workflow } from "lucide-react";

import type {
  FivetranMcpTraceStep,
  PipelineLineageEntry,
} from "@/lib/connectors/fivetranPipelineDiscovery";
import type { FivetranAgentToolSource } from "@/lib/connectors/fivetranAgentBridge";

import { Badge, StepPanel } from "./ui";

type Props = {
  mcpTrace: FivetranMcpTraceStep[] | null;
  pipelineLineage: PipelineLineageEntry[] | null;
  discoverySource: FivetranAgentToolSource | null;
  toolsRun: number | null;
};

const sourceLabel: Record<FivetranAgentToolSource, string> = {
  mcp_runtime: "Fivetran MCP runtime",
  rest: "REST fallback",
  mock: "Mock adapter",
};

export function PipelineDiscoveryPanel({
  mcpTrace,
  pipelineLineage,
  discoverySource,
  toolsRun,
}: Props) {
  const hasData = mcpTrace && mcpTrace.length > 0;

  return (
    <StepPanel id="step-2b" title="Fivetran MCP discovery" bodyClassName="p-4">
      {!hasData ? (
        <p className="text-[13px] text-cops-on-surface-variant">
          Run a scan to execute read-only Fivetran MCP tools and map pipeline lineage.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Badge tone="info">
              <Workflow className="mr-1 inline h-3 w-3" aria-hidden />
              MCP tools run: {toolsRun ?? mcpTrace.length}
            </Badge>
            {discoverySource && (
              <Badge tone="neutral">{sourceLabel[discoverySource]}</Badge>
            )}
          </div>

          <div>
            <h3 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-cops-outline">
              Tool trace
            </h3>
            <ol className="space-y-2">
              {mcpTrace.map((step, index) => (
                <li
                  key={`${step.tool}-${index}`}
                  className="flex gap-2 rounded border border-cops-outline-variant bg-cops-surface px-3 py-2"
                >
                  {step.ok ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-cops-on-tertiary-container"
                      aria-hidden
                    />
                  ) : (
                    <CircleDashed
                      className="mt-0.5 h-4 w-4 shrink-0 text-cops-outline"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-semibold text-cops-primary">
                      {step.tool}
                      {step.enrichedFrom && (
                        <span className="ml-2 font-normal text-cops-secondary">
                          enriched via {step.enrichedFrom}
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] leading-snug text-cops-on-surface-variant">
                      {step.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {pipelineLineage && pipelineLineage.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-wider text-cops-outline">
                <GitBranch className="h-3 w-3" aria-hidden />
                Pipeline lineage
              </h3>
              <div className="space-y-2">
                {pipelineLineage.map((entry) => (
                  <div
                    key={entry.connectorAlias}
                    className="rounded border border-cops-outline-variant bg-cops-surface-container-low p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-cops-secondary">
                        {entry.connectorAlias}
                      </span>
                      <Badge tone="neutral">{entry.service}</Badge>
                      <Badge tone="neutral">schema: {entry.schema}</Badge>
                      <Badge
                        tone={
                          entry.health === "healthy"
                            ? "success"
                            : entry.health === "warning"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {entry.health}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.mappedTables.map((table) => (
                        <span
                          key={table}
                          className="rounded bg-cops-surface-container-high px-2 py-0.5 font-mono text-[10px] text-cops-on-surface-variant"
                        >
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </StepPanel>
  );
}
