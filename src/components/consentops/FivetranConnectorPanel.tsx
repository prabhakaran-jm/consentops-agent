import { AlertTriangle, Cable, History, ShieldCheck } from "lucide-react";

import { FIVETRAN_DEMO_NARRATIVE } from "@/lib/connectors/fivetranAdapter";
import type { FivetranConnectorPanelData } from "@/lib/connectors/fivetranPanelData";

import { Badge, formatRelativeTime, StepPanel } from "./ui";

type Props = {
  fivetran: FivetranConnectorPanelData | null;
};

function healthTone(
  health: FivetranConnectorPanelData["connectors"][number]["health"],
): "success" | "warning" | "danger" {
  if (health === "healthy") return "success";
  if (health === "warning") return "warning";
  return "danger";
}

function connectorAbbr(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function FivetranConnectorPanel({ fivetran }: Props) {
  return (
    <StepPanel id="step-2" step={2} title="Active Connectors" bodyClassName="p-4">
      {!fivetran ? (
        <p className="text-[13px] text-cops-on-surface-variant">Run a scan to load connector status.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 px-2">
            <Badge tone="info">{fivetran.modeLabel}</Badge>
            <Badge tone="neutral">
              <ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden />
              {fivetran.readOnlyNote}
            </Badge>
          </div>

          {fivetran.emptyConnectionsHint && (
            <p className="mx-2 rounded-lg border border-[#FAD2CF] bg-[#FCE8E6] px-3 py-2 text-[13px] text-cops-on-error-container">
              {fivetran.emptyConnectionsHint}
            </p>
          )}

          {fivetran.connectors.map((connector) => {
            const warning = connector.health === "warning";
            return (
              <div
                key={connector.displayKey}
                className={`relative overflow-hidden rounded border p-3 ${
                  warning
                    ? "border-cops-error/50 bg-[#FFF8F7] shadow-[0_0_10px_rgba(186,26,26,0.05)]"
                    : "border-cops-outline-variant bg-cops-surface hover:border-cops-secondary"
                }`}
              >
                <div
                  className={`absolute bottom-0 right-0 top-0 w-1 ${
                    warning ? "bg-cops-error" : "bg-cops-on-tertiary-container"
                  }`}
                />
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-cops-outline-variant bg-cops-surface-container-high font-mono text-[11px] font-bold text-cops-secondary">
                      {connectorAbbr(connector.name)}
                    </div>
                    <div>
                      <h3 className="text-[13px] font-semibold leading-tight text-cops-primary">
                        {connector.name}
                      </h3>
                      <p className="font-mono text-[10px] text-cops-on-surface-variant">
                        {connector.source} → {connector.destination}
                      </p>
                    </div>
                  </div>
                  <Badge tone={healthTone(connector.health)}>
                    {warning && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />}
                    {connector.health}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-cops-outline-variant pt-2">
                  <span className="font-mono text-[11px] text-cops-on-surface-variant">
                    {connector.mappedTables.length} target
                    {connector.mappedTables.length === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-cops-outline">
                    <History className="h-3 w-3" aria-hidden />
                    Scanned {formatRelativeTime(connector.lastSyncedAtIso)}
                  </span>
                </div>
                {warning && (
                  <p className="mt-2 text-[12px] font-medium text-cops-on-error-container">
                    Last sync failed — warehouse data may be stale.
                  </p>
                )}
              </div>
            );
          })}

          {fivetran.connectors.length === 0 && (
            <div className="flex gap-2 rounded border border-cops-outline-variant bg-cops-surface-container-low p-3 text-[13px] text-cops-on-surface-variant">
              <Cable className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {FIVETRAN_DEMO_NARRATIVE}
            </div>
          )}
        </div>
      )}
    </StepPanel>
  );
}
