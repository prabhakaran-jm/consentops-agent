"use client";

import {
  ClipboardList,
  ExternalLink,
  Layers,
  Map,
  Network,
  ScanSearch,
  Settings,
  ShieldCheck,
  Trash2,
  Workflow,
} from "lucide-react";

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

const GITHUB_README = "https://github.com/prabhakaran-jm/ConsentOps-Agent#readme";

type Props = {
  activeStep?: string;
  onScan: () => void;
  scanning?: boolean;
};

export function DashboardSidebar({ activeStep = "step-1", onScan, scanning }: Props) {
  return (
    <nav className="fixed hidden h-full w-64 flex-col border-r border-cops-outline-variant bg-cops-surface-container-low lg:flex">
      <div className="border-b border-cops-outline-variant p-6">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex w-full items-center gap-3 rounded-lg text-left transition-colors hover:bg-cops-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cops-secondary"
          title="Refresh dashboard"
          aria-label="Refresh ConsentOps dashboard"
        >
          <ConsentOpsLogo />
          <div>
            <p className="font-mono text-xs font-bold text-cops-primary">ConsentOps</p>
            <p className="font-mono text-[10px] text-cops-outline">Click to refresh</p>
          </div>
        </button>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto py-4">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeStep === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                className={`mx-2 flex items-center gap-3 rounded-lg p-3 font-mono text-xs transition-colors ${
                  active
                    ? "scale-[0.98] bg-cops-secondary-container text-cops-on-secondary-container shadow-sm"
                    : "text-cops-on-surface-variant hover:bg-cops-surface-container-high"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-cops-outline-variant p-4">
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="flex w-full items-center justify-center gap-2 rounded bg-cops-primary py-2 text-xs font-medium text-cops-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <ScanSearch className="h-4 w-4" aria-hidden />
          {scanning ? "Scanning…" : "Scan Data Spread"}
        </button>
        <ul className="mt-4 space-y-1">
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
