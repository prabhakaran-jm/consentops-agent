"use client";

import {
  Bot,
  ClipboardList,
  HelpCircle,
  Layers,
  Map,
  Network,
  ScanSearch,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const NAV = [
  { id: "step-1", label: "Deletion Request", icon: Trash2 },
  { id: "step-2", label: "Connectors", icon: Network },
  { id: "step-3", label: "Spread Map", icon: Map },
  { id: "step-4", label: "Cleanup Plan", icon: Layers },
  { id: "step-5", label: "Approval", icon: ShieldCheck },
  { id: "step-6", label: "Audit Report", icon: ClipboardList },
] as const;

type Props = {
  activeStep?: string;
  onScan: () => void;
  scanning?: boolean;
};

export function DashboardSidebar({ activeStep = "step-1", onScan, scanning }: Props) {
  return (
    <nav className="fixed hidden h-full w-64 flex-col border-r border-cops-outline-variant bg-cops-surface-container-low lg:flex">
      <div className="border-b border-cops-outline-variant p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cops-primary-container text-cops-on-primary-container">
            <Bot className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="font-mono text-xs font-bold text-cops-primary">ConsentOps</p>
            <p className="font-mono text-xs text-cops-on-surface-variant">Technical Mode</p>
          </div>
        </div>
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
            <span className="flex items-center gap-3 p-2 font-mono text-xs text-cops-on-surface-variant">
              <Settings className="h-4 w-4" aria-hidden />
              Settings
            </span>
          </li>
          <li>
            <span className="flex items-center gap-3 p-2 font-mono text-xs text-cops-on-surface-variant">
              <HelpCircle className="h-4 w-4" aria-hidden />
              Support
            </span>
          </li>
        </ul>
      </div>
    </nav>
  );
}
