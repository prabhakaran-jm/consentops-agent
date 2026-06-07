"use client";

import {
  ClipboardList,
  ExternalLink,
  Layers,
  Map,
  Network,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Workflow,
} from "lucide-react";

import { GITHUB_REPO_URL } from "@/lib/demo/publicLinks";

import { ConsentOpsLogo } from "./ConsentOpsLogo";

const NAV = [
  { id: "step-1", label: "Deletion Request", icon: Trash2 },
  { id: "step-2", label: "Connectors", icon: Network },
  { id: "step-2b", label: "MCP discovery", icon: Workflow },
  { id: "step-3", label: "Spread Map", icon: Map },
  { id: "step-4", label: "Cleanup Plan", icon: Layers },
  { id: "step-5", label: "Approval", icon: ShieldCheck },
  { id: "step-6", label: "Audit Report", icon: ClipboardList },
] as const;

const GITHUB_README = `${GITHUB_REPO_URL}#readme`;

type Props = {
  activeStep?: string;
  completedStepIds?: ReadonlySet<string>;
};

export function DashboardSidebar({
  activeStep = "step-1",
  completedStepIds,
}: Props) {
  return (
    <nav className="fixed hidden h-full w-64 flex-col border-r border-cops-outline-variant bg-cops-surface-container-low lg:flex">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ConsentOpsLogo variant="embedded" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-cops-primary">ConsentOps</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cops-outline">Agent</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg p-2 text-cops-outline transition-colors hover:bg-cops-surface-container-high hover:text-cops-secondary"
          title="Refresh dashboard"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mx-4 mb-2 border-b border-cops-outline-variant/80" aria-hidden />

      <ul className="flex-1 space-y-1 overflow-y-auto pb-4 pt-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeStep === id;
          const complete = completedStepIds?.has(id) ?? false;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                className={`mx-2 flex items-center gap-3 rounded-lg p-3 font-mono text-xs transition-colors ${
                  active
                    ? "scale-[0.98] bg-cops-secondary-container text-cops-on-secondary-container shadow-sm"
                    : complete
                      ? "text-cops-on-tertiary-container hover:bg-cops-surface-container-high"
                      : "text-cops-on-surface-variant hover:bg-cops-surface-container-high"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {complete && !active ? (
                  <span className="font-mono text-[10px] text-cops-on-tertiary-container" aria-label="Complete">
                    ✓
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-cops-outline-variant p-4">
        <ul className="space-y-1">
          <li>
            <a
              href="#platform-status"
              onClick={(event) => {
                event.preventDefault();
                const panel = document.getElementById("platform-status");
                if (panel instanceof HTMLDetailsElement) {
                  panel.open = true;
                }
                panel?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-3 rounded-lg p-2 font-mono text-xs text-cops-on-surface-variant transition-colors hover:bg-cops-surface-container-high hover:text-cops-primary"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Platform status
            </a>
          </li>
          <li>
            <a
              href={GITHUB_README}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg p-2 font-mono text-xs text-cops-on-surface-variant transition-colors hover:bg-cops-surface-container-high hover:text-cops-primary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Docs &amp; support
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
