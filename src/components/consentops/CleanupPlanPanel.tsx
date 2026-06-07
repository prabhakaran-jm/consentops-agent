import { Bot, CheckCircle, ClipboardList, Info, ShieldBan, Sparkles } from "lucide-react";

import type { CleanupAction, CleanupPlan } from "@/lib/warehouse/types";

import type { PlanProvenance } from "./types";
import { Badge, PrimaryButton, StepPanel } from "./ui";

const BLOCKED_POLICIES = [
  "No cleanup execution without explicit human approval.",
  "No table-wide deletion or wildcard record targeting.",
  "No deletion or anonymization on payments_transactions (retain-only).",
  "No unapproved action may be executed.",
];

/** Gemini may return snake_case policy ids — show readable labels in the UI. */
const humanizeBlockedPolicy = (line: string): string => {
  if (/[.!?]/.test(line) || /\s/.test(line.trim())) {
    return line.trim();
  }
  const sentence = line
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
};

const blockedPoliciesForDisplay = (blocked: string[] | undefined): string[] => {
  if (!blocked?.length) return [...BLOCKED_POLICIES];
  return blocked.map(humanizeBlockedPolicy);
};

const SAFETY_CHECKS = [
  { title: "Record-scoped actions only", detail: "Every action targets explicit record IDs — no table-wide cleanup." },
  { title: "Financial retention rules", detail: "payments_transactions is retain-only; deletes blocked." },
  { title: "Approval gate enforced", detail: "Execution requires explicit human approval in Step 5." },
];

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
  geminiModel?: string | null;
};

export function CleanupPlanPanel({
  plan,
  provenance,
  onGenerate,
  loading,
  canGenerate,
  geminiModel,
}: Props) {
  const counts = plan
    ? {
        delete: plan.actions.filter((a) => a.classification === "delete").length,
        anonymize: plan.actions.filter((a) => a.classification === "anonymize").length,
        retain: plan.actions.filter((a) => a.classification === "retain").length,
        review: plan.actions.filter((a) => a.classification === "review").length,
      }
    : null;

  return (
    <StepPanel
      id="step-4"
      step={4}
      title="Cleanup Plan Generation"
      headerRight={
        plan ? (
          <PrimaryButton onClick={onGenerate} loading={loading} disabled={!canGenerate}>
            Regenerate plan
          </PrimaryButton>
        ) : null
      }
    >
      {!plan ? (
        <div className="space-y-4">
          <p className="text-[13px] text-cops-on-surface-variant">
            Scan first, then generate a classified cleanup plan. Gemini is advisory; deterministic safety rules
            always override.
          </p>
          <PrimaryButton onClick={onGenerate} loading={loading} disabled={!canGenerate}>
            <ClipboardList className="h-4 w-4" aria-hidden />
            Generate cleanup plan
          </PrimaryButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-low p-4">
              <div className="mb-4 flex items-center justify-between border-b border-cops-outline-variant pb-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-cops-secondary" aria-hidden />
                  <h4 className="text-sm font-semibold">Planned by Gemini (Advisory)</h4>
                </div>
                <span className="rounded bg-cops-surface-container-high px-2 py-0.5 font-mono text-[10px] text-cops-on-surface-variant">
                  {geminiModel ?? "gemini-3.5-flash"}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {provenance?.source === "gemini" ? (
                  <Badge tone="info">
                    <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                    Gemini planner
                  </Badge>
                ) : (
                  <Badge tone="neutral">Deterministic fallback</Badge>
                )}
                <Badge tone="danger">delete: {counts!.delete}</Badge>
                <Badge tone="warning">anonymize: {counts!.anonymize}</Badge>
                <Badge tone="success">retain: {counts!.retain}</Badge>
                <Badge tone="info">review: {counts!.review}</Badge>
              </div>
              {provenance?.warning && (
                <p className="mb-3 rounded border border-[#FAD2CF] bg-[#FCE8E6] px-3 py-2 text-xs text-cops-on-error-container">
                  {provenance.warning}
                </p>
              )}
              <div className="max-h-64 overflow-y-auto rounded border border-cops-outline-variant">
                <ul className="divide-y divide-cops-outline-variant text-[13px]">
                  {plan.actions.map((action) => (
                    <li key={action.id} className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-cops-on-surface-variant">{action.id}</span>
                        <Badge tone={classificationTone(action.classification)}>{action.classification}</Badge>
                      </div>
                      <p className="font-mono text-cops-primary">
                        {action.table} → {action.recordIds.join(", ")}
                      </p>
                      {action.retainReason && (
                        <p className="text-xs text-cops-on-error-container">Reason: {action.retainReason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg border border-cops-outline-variant border-l-4 border-l-cops-on-tertiary-container bg-cops-surface-container-lowest p-4 shadow-inner">
            <div className="mb-4 flex items-center gap-2 border-b border-cops-outline-variant pb-2">
              <ShieldBan className="h-4 w-4 text-cops-on-tertiary-container" aria-hidden />
              <h4 className="text-sm font-semibold">Deterministic Safety Validation</h4>
            </div>
            <ul className="space-y-4">
              {SAFETY_CHECKS.map((check) => (
                <li key={check.title} className="flex gap-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-cops-on-tertiary-container" aria-hidden />
                  <div>
                    <p className="text-[13px] font-semibold">{check.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-cops-on-surface-variant">{check.detail}</p>
                  </div>
                </li>
              ))}
              <li className="mt-4 flex gap-3 rounded border border-cops-outline-variant bg-cops-surface-container-high p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cops-secondary" aria-hidden />
                <p className="text-[13px]">Rule sets strictly override advisory AI planning.</p>
              </li>
            </ul>
            <div className="mt-4 border-t border-cops-outline-variant pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-cops-outline">
                Blocked without approval
              </p>
              <ul className="max-h-28 space-y-2 overflow-y-auto text-[12px] leading-snug text-cops-on-surface-variant">
                {blockedPoliciesForDisplay(provenance?.blockedActions).map((line) => (
                  <li key={line} className="break-words rounded bg-cops-surface-container-high px-2 py-1.5">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </StepPanel>
  );
}
