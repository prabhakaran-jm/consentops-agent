import { Activity, ShieldCheck } from "lucide-react";

import type { PlatformStatus } from "@/lib/platform/platformStatus";

import { Badge } from "./ui";

type Props = {
  status: PlatformStatus | null;
  loading?: boolean;
  compact?: boolean;
};

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function PlatformStatusPanel({ status, loading, compact }: Props) {
  if (compact) {
    const operational = status && !status.workflow.lastPlanWarning;
    return (
      <div className="flex items-center gap-4 rounded border border-cops-outline-variant bg-cops-surface-container-lowest p-3">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wider text-cops-outline">
            Platform status
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                loading ? "bg-cops-outline" : operational ? "bg-cops-on-tertiary-container shadow-[0_0_8px_rgba(0,150,104,0.4)]" : "bg-amber-500"
              }`}
            />
            <span className="text-[13px] font-medium">
              {loading ? "Loading…" : operational ? "All systems operational" : "Check planner warning"}
            </span>
          </div>
        </div>
        {status?.gemini.model && (
          <Badge tone="info">{status.gemini.model}</Badge>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest p-5 shadow-sm lg:col-span-2">
      <p className="text-[13px] text-cops-on-surface-variant">
        Read-only runtime summary for judges. No secrets, API keys, or real personal data.
      </p>

      {loading && !status ? (
        <p className="mt-3 text-[13px] text-cops-on-surface-variant">Loading status…</p>
      ) : !status ? (
        <p className="mt-3 text-[13px] text-cops-on-surface-variant">Status unavailable.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Synthetic data only</Badge>
            <Badge tone="neutral">v{status.build.version}</Badge>
            {status.gemini.configured ? (
              <Badge tone="info">Gemini configured</Badge>
            ) : (
              <Badge tone="neutral">Gemini not configured</Badge>
            )}
            <Badge tone="neutral">Fivetran: {status.adapters.fivetranIntegrationSource}</Badge>
            {status.adapters.fivetranMcpRuntimeEnabled ? <Badge tone="info">MCP runtime</Badge> : null}
            <Badge tone="neutral">Warehouse: {status.adapters.warehouse}</Badge>
            <Badge tone="neutral">Scan: {status.adapters.warehouseScanSource}</Badge>
            <Badge tone="neutral">Execute: {status.adapters.warehouseExecution}</Badge>
          </div>

          <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="font-medium text-cops-on-surface">Gemini model</dt>
              <dd className="text-cops-on-surface-variant">{status.gemini.model ?? "— (deterministic planner)"}</dd>
            </div>
            <div>
              <dt className="font-medium text-cops-on-surface">Last plan source</dt>
              <dd className="text-cops-on-surface-variant">
                {status.workflow.lastPlanSource ?? "— (generate a plan)"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-cops-on-surface">Demo flags</dt>
              <dd className="text-cops-on-surface-variant">
                DEMO_MODE={yesNo(status.demoModeDocumented.DEMO_MODE)}, CONSENTOPS_DEMO_MODE=
                {yesNo(status.demoModeDocumented.CONSENTOPS_DEMO_MODE)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-cops-on-surface">Production adapters</dt>
              <dd className="text-cops-on-surface-variant">
                Fivetran {status.adapters.fivetranPanelMode}
                {status.adapters.fivetranIntegrationSource === "mock" ? " (mock)" : " (credentials set)"}, BigQuery{" "}
                {status.adapters.bigQueryConfigured
                  ? `${status.adapters.bigQueryProjectId}.${status.adapters.bigQueryDataset}`
                  : "not configured"}
              </dd>
            </div>
          </dl>

          {status.workflow.lastPlanWarning && (
            <p className="rounded-lg border border-[#FAD2CF] bg-[#FCE8E6] px-3 py-2 text-xs text-cops-on-error-container">
              Last planner warning: {status.workflow.lastPlanWarning}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs text-cops-outline">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {status.disclaimer} {status.demoModeDocumented.note}
          </p>
        </div>
      )}
    </section>
  );
}

export function HumanInLoopBanner() {
  return (
    <div className="flex items-start gap-3 rounded border border-cops-outline-variant bg-cops-surface-container p-4">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cops-secondary" aria-hidden />
      <div>
        <h4 className="mb-1 text-[13px] font-semibold text-cops-primary">Human-in-the-loop required</h4>
        <p className="text-[12px] leading-relaxed text-cops-on-surface-variant">
          No data is modified during scanning. Review and approve the cleanup plan before any records are deleted or
          anonymized in the warehouse.
        </p>
      </div>
    </div>
  );
}
