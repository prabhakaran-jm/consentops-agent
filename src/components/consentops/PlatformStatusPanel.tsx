import { Activity } from "lucide-react";

import type { PlatformStatus } from "@/lib/platform/platformStatus";

import { Badge, Panel } from "./ui";

type Props = {
  status: PlatformStatus | null;
  loading?: boolean;
};

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function PlatformStatusPanel({ status, loading }: Props) {
  return (
    <Panel title="Platform status" className="lg:col-span-2">
      <p className="text-sm text-slate-600">
        Read-only runtime summary for judges. No secrets, API keys, or real personal data.
      </p>

      {loading && !status ? (
        <p className="text-sm text-slate-500">Loading status…</p>
      ) : !status ? (
        <p className="text-sm text-slate-500">Status unavailable.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Synthetic data only</Badge>
            <Badge tone="neutral">v{status.build.version}</Badge>
            {status.gemini.configured ? (
              <Badge tone="info">Gemini configured</Badge>
            ) : (
              <Badge tone="neutral">Gemini not configured</Badge>
            )}
            <Badge tone="neutral">Fivetran: {status.adapters.fivetranActive}</Badge>
            <Badge tone="neutral">Warehouse: {status.adapters.warehouse}</Badge>
            <Badge tone="neutral">Scan: {status.adapters.warehouseScanSource}</Badge>
            <Badge tone="neutral">Execute: {status.adapters.warehouseExecution}</Badge>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-700">Gemini model</dt>
              <dd className="text-slate-600">{status.gemini.model ?? "— (deterministic planner)"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Last plan source</dt>
              <dd className="text-slate-600">
                {status.workflow.lastPlanSource ?? "— (generate a plan)"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Demo flags documented</dt>
              <dd className="text-slate-600">
                DEMO_MODE={yesNo(status.demoModeDocumented.DEMO_MODE)}, CONSENTOPS_DEMO_MODE=
                {yesNo(status.demoModeDocumented.CONSENTOPS_DEMO_MODE)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Production adapters configured</dt>
              <dd className="text-slate-600">
                Fivetran {status.adapters.fivetranPanelMode}
                {status.adapters.fivetranRealConfigured ? " (credentials set)" : " (mock)"}, BigQuery{" "}
                {status.adapters.bigQueryConfigured
                  ? `${status.adapters.bigQueryProjectId}.${status.adapters.bigQueryDataset}`
                  : "not configured"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Workflow state</dt>
              <dd className="text-slate-600">
                plan={yesNo(status.workflow.hasLatestPlan)}, audit=
                {yesNo(status.workflow.hasLatestAudit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Status generated</dt>
              <dd className="font-mono text-xs text-slate-600">{status.generatedAtIso}</dd>
            </div>
          </dl>

          {status.workflow.lastPlanWarning && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Last planner warning: {status.workflow.lastPlanWarning}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {status.disclaimer} {status.demoModeDocumented.note}
          </p>
        </div>
      )}
    </Panel>
  );
}
