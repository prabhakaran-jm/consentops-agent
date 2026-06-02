import { Lock, Play } from "lucide-react";

import type { CleanupAction, CleanupPlan } from "@/lib/warehouse/types";

import { Panel, PrimaryButton } from "./ui";

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

  return (
    <Panel title="Approval" step={5}>
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong>No cleanup happens without approval.</strong> This is a human-in-the-loop
          workflow. Select record-scoped actions below, then execute only what you explicitly
          approve.
        </p>
      </div>

      {!plan ? (
        <p className="text-sm text-slate-500">Generate a cleanup plan before approving actions.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
            <span className="self-center text-sm text-slate-600">
              {selectedIds.size} of {plan.actions.length} selected
            </span>
          </div>

          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {plan.actions.map((action) => (
              <ActionCheckbox
                key={action.id}
                action={action}
                checked={selectedIds.has(action.id)}
                onToggle={() => onToggle(action.id)}
              />
            ))}
          </ul>
        </>
      )}

      <PrimaryButton onClick={onExecute} loading={loading} disabled={!canExecute}>
        <Play className="h-4 w-4" aria-hidden />
        Execute approved cleanup
      </PrimaryButton>
      {executionCompleted && (
        <p className="text-sm text-emerald-700">
          Cleanup executed for this plan. Generate a new plan to run another demo execution.
        </p>
      )}
    </Panel>
  );
}

function ActionCheckbox({
  action,
  checked,
  onToggle,
}: {
  action: CleanupAction;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-900">{action.classification}</span>
          <span className="text-slate-500"> — </span>
          <span className="font-mono text-xs text-slate-700">
            {action.table} / {action.recordIds.join(", ")}
          </span>
        </span>
      </label>
    </li>
  );
}
