import { AlertTriangle, Cable, ShieldCheck } from "lucide-react";

import { FIVETRAN_DEMO_NARRATIVE } from "@/lib/connectors/fivetranAdapter";
import type { FivetranConnectorPanelData } from "@/lib/connectors/fivetranPanelData";

import { Badge, formatIsoTime, Panel } from "./ui";

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

export function FivetranConnectorPanel({ fivetran }: Props) {
  return (
    <Panel title="Fivetran connectors (read-only status)" step={2}>
      <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-950">
        <Cable className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
        <p>{FIVETRAN_DEMO_NARRATIVE}</p>
      </div>

      {!fivetran ? (
        <p className="text-sm text-slate-500">Run a scan to load connector status.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{fivetran.modeLabel}</Badge>
            <Badge tone="info">
              <ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden />
              {fivetran.readOnlyNote}
            </Badge>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Connections</dt>
              <dd className="font-medium text-slate-900">{fivetran.connectionCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Healthy</dt>
              <dd className="font-medium text-emerald-700">{fivetran.healthSummary.healthy}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Warning</dt>
              <dd className="font-medium text-amber-700">{fivetran.healthSummary.warning}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Offline</dt>
              <dd className="font-medium text-slate-700">{fivetran.healthSummary.offline}</dd>
            </div>
          </dl>

          <ul className="space-y-3">
            {fivetran.connectors.map((connector) => (
              <li
                key={connector.displayKey}
                className={`rounded-lg border p-4 ${
                  connector.health === "warning"
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{connector.name}</p>
                    <p className="font-mono text-xs text-slate-500">{connector.displayKey}</p>
                    <p className="text-xs text-slate-500">
                      {connector.source} → {connector.destination}
                    </p>
                  </div>
                  <Badge tone={healthTone(connector.health)}>
                    {connector.health === "warning" && (
                      <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                    )}
                    {connector.health}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Last sync: {formatIsoTime(connector.lastSyncedAtIso)} ({connector.lastSyncStatus})
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Mapped tables:{" "}
                  <span className="font-mono text-slate-700">{connector.mappedTables.join(", ")}</span>
                </p>
                {connector.health === "warning" && (
                  <p className="mt-2 text-sm font-medium text-amber-900">
                    Warning: last sync failed — support tickets may be stale in the warehouse.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
