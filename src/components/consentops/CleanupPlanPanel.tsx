import { ClipboardList, ShieldBan, Sparkles } from "lucide-react";

import type { CleanupAction, CleanupPlan } from "@/lib/warehouse/types";

import type { PlanProvenance } from "./types";
import { Badge, Panel, PrimaryButton } from "./ui";

const BLOCKED_POLICIES = [
  "Delete on payments_transactions is forbidden (retain-only).",
  "Anonymize on payments_transactions is forbidden (retain-only).",
  "Table-wide or wildcard record targeting is blocked.",
  "Destructive actions require explicit approval before execution.",
];

function riskForAction(action: CleanupAction): { label: string; tone: "danger" | "warning" | "success" | "info" } {
  switch (action.classification) {
    case "delete":
      return { label: "High", tone: "danger" };
    case "anonymize":
      return { label: "Medium", tone: "warning" };
    case "review":
      return { label: "Review", tone: "info" };
    case "retain":
      return { label: "Retain", tone: "success" };
  }
}

function classificationTone(c: CleanupAction["classification"]): "danger" | "warning" | "success" | "info" {
  if (c === "delete") return "danger";
  if (c === "anonymize") return "warning";
  if (c === "retain") return "success";
  return "info";
}

type Props = {
  plan: CleanupPlan | null;
  provenance: PlanProvenance | null;
  onGenerate: () => void;
  loading: boolean;
  canGenerate: boolean;
};

export function CleanupPlanPanel({ plan, provenance, onGenerate, loading, canGenerate }: Props) {
  const counts = plan
    ? {
        delete: plan.actions.filter((a) => a.classification === "delete").length,
        anonymize: plan.actions.filter((a) => a.classification === "anonymize").length,
        retain: plan.actions.filter((a) => a.classification === "retain").length,
        review: plan.actions.filter((a) => a.classification === "review").length,
      }
    : null;

  return (
    <Panel title="Cleanup plan" step={4}>
      <p className="text-sm text-slate-600">
        Every action targets explicit record IDs — no table-wide cleanup. Gemini is advisory only;
        plans must pass deterministic safety validation (synthetic demo data).
      </p>
      <PrimaryButton onClick={onGenerate} loading={loading} disabled={!canGenerate}>
        <ClipboardList className="h-4 w-4" aria-hidden />
        Generate cleanup plan
      </PrimaryButton>

      {!plan ? (
        <p className="text-sm text-slate-500">Scan first, then generate a classified plan.</p>
      ) : (
        <>
          {provenance && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {provenance.source === "gemini" ? (
                  <Badge tone="info">
                    <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                    Planned by Gemini
                  </Badge>
                ) : (
                  <Badge tone="neutral">Deterministic fallback planner</Badge>
                )}
              </div>
              {provenance.warning && (
                <p className="text-xs text-amber-800" role="status">
                  {provenance.warning}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge tone="danger">delete: {counts!.delete}</Badge>
            <Badge tone="warning">anonymize: {counts!.anonymize}</Badge>
            <Badge tone="success">retain: {counts!.retain}</Badge>
            <Badge tone="info">review: {counts!.review}</Badge>
            <Badge tone="neutral">{plan.actions.length} record-scoped actions</Badge>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <ul className="divide-y divide-slate-100 text-sm">
              {plan.actions.map((action) => {
                const risk = riskForAction(action);
                return (
                  <li key={action.id} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{action.id}</span>
                      <Badge tone={classificationTone(action.classification)}>
                        {action.classification}
                      </Badge>
                      <Badge tone={risk.tone}>Risk: {risk.label}</Badge>
                    </div>
                    <p className="font-mono text-slate-800">
                      {action.table} → {action.recordIds.join(", ")}
                    </p>
                    <p className="text-xs text-slate-500">Fields: {action.fields.join(", ")}</p>
                    {action.retainReason && (
                      <p className="text-xs text-amber-800">Reason: {action.retainReason}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <ShieldBan className="h-4 w-4" aria-hidden />
              Blocked by safety policy
            </p>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
              {(provenance?.blockedActions.length ? provenance.blockedActions : BLOCKED_POLICIES).map(
                (line) => (
                  <li key={line}>{line}</li>
                ),
              )}
            </ul>
          </div>
        </>
      )}
    </Panel>
  );
}
