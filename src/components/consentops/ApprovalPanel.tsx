import { Gavel, Lock } from "lucide-react";

import type { CleanupAction, CleanupPlan } from "@/lib/warehouse/types";

import { SlideToConfirm } from "./SlideToConfirm";
import { Badge, StepPanel } from "./ui";

type Props = {
  plan: CleanupPlan | null;
  selectedIds: Set<string>;
  onToggle: (actionId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExecute: () => void;
  loading: boolean;
  executionCompleted: boolean;
};

function actionBadgeTone(c: CleanupAction["classification"]): "danger" | "warning" | "success" | "info" | "neutral" {
  if (c === "delete") return "danger";
  if (c === "anonymize") return "warning";
  if (c === "retain") return "success";
  if (c === "review") return "info";
  return "neutral";
}

export function ApprovalPanel({
  plan,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  onExecute,
  loading,
  executionCompleted,
}: Props) {
  const canExecute = Boolean(plan) && selectedIds.size > 0 && !executionCompleted;
  const selectedActions = plan?.actions.filter((a) => selectedIds.has(a.id)) ?? [];

  return (
    <StepPanel id="step-5" step={5} title="Approval Required">
      <div className="mb-6 flex gap-3 rounded-lg border border-[#FAD2CF] bg-[#FCE8E6] p-3 text-[13px] text-cops-on-error-container">
        <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong>No cleanup happens without approval.</strong> Select record-scoped actions, then slide to confirm
          execution.
        </p>
      </div>

      {!plan ? (
        <p className="text-[13px] text-cops-on-surface-variant">Generate a cleanup plan before approving actions.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded border border-cops-outline-variant px-3 py-1.5 text-xs font-medium hover:bg-cops-surface-container-low"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded border border-cops-outline-variant px-3 py-1.5 text-xs font-medium hover:bg-cops-surface-container-low"
            >
              Clear
            </button>
            <span className="self-center text-[13px] text-cops-on-surface-variant">
              {selectedIds.size} of {plan.actions.length} selected
            </span>
          </div>

          <div className="mb-6 overflow-hidden rounded border border-cops-outline-variant">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-cops-outline-variant bg-cops-surface-container-high">
                  <th className="px-4 py-2 font-mono text-[10px] uppercase text-cops-on-surface-variant">Select</th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase text-cops-on-surface-variant">Table</th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase text-cops-on-surface-variant">Action</th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase text-cops-on-surface-variant">Records</th>
                </tr>
              </thead>
              <tbody>
                {plan.actions.map((action) => (
                  <tr key={action.id} className="border-b border-cops-outline-variant last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(action.id)}
                        onChange={() => onToggle(action.id)}
                        className="h-4 w-4 rounded border-cops-outline-variant"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-cops-primary">{action.table}</td>
                    <td className="px-4 py-3">
                      <Badge tone={actionBadgeTone(action.classification)}>
                        {action.classification.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {action.recordIds.length} row{action.recordIds.length === 1 ? "" : "s"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedActions.length > 0 && (
            <div className="mb-6 rounded border border-cops-outline-variant bg-cops-surface-container-low p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-cops-primary">
                <Gavel className="h-4 w-4 text-cops-secondary" aria-hidden />
                Pending approval summary
              </p>
              <ul className="space-y-1 font-mono text-[11px] text-cops-on-surface-variant">
                {selectedActions.map((a) => (
                  <li key={a.id}>
                    {a.classification.toUpperCase()} · {a.table} · {a.recordIds.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SlideToConfirm
            onConfirm={onExecute}
            disabled={!canExecute}
            loading={loading}
            label="Slide to confirm execute"
          />

          {executionCompleted && (
            <p className="mt-4 text-center text-[13px] text-cops-on-tertiary-container">
              Cleanup executed. View the audit report below.
            </p>
          )}
        </>
      )}
    </StepPanel>
  );
}
