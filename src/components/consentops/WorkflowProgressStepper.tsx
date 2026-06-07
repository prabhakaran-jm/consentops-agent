import { Check } from "lucide-react";

import {
  resolveWorkflowPhaseStates,
  type WorkflowPhase,
  type WorkflowProgressInput,
} from "./workflowProgress";

type Props = WorkflowProgressInput;

const PHASES: { key: WorkflowPhase; label: string }[] = [
  { key: "scan", label: "Scan" },
  { key: "plan", label: "Plan" },
  { key: "approve", label: "Approve" },
  { key: "execute", label: "Execute" },
  { key: "audit", label: "Audit" },
];

export function WorkflowProgressStepper(props: Props) {
  const states = resolveWorkflowPhaseStates(props);

  return (
    <nav
      aria-label="Consent workflow progress"
      className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-lowest px-4 py-4"
    >
      <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
        {PHASES.map((phase, index) => {
          const state = states[phase.key];
          const isLast = index === PHASES.length - 1;

          return (
            <li key={phase.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-colors ${
                    state === "complete"
                      ? "bg-cops-on-tertiary-container text-white"
                      : state === "current"
                        ? "bg-cops-secondary text-cops-on-secondary ring-2 ring-cops-secondary-container"
                        : "border border-cops-outline-variant bg-cops-surface text-cops-outline"
                  }`}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {state === "complete" ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <span
                  className={`font-mono text-[11px] uppercase tracking-wide ${
                    state === "current"
                      ? "font-semibold text-cops-primary"
                      : state === "complete"
                        ? "text-cops-on-tertiary-container"
                        : "text-cops-outline"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {!isLast && (
                <span
                  className={`mx-2 hidden h-px w-6 sm:block md:w-10 ${
                    state === "complete" ? "bg-cops-on-tertiary-container" : "bg-cops-outline-variant"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
