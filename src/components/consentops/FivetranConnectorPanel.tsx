import { AlertTriangle, Cable } from "lucide-react";

import { FIVETRAN_DEMO_NARRATIVE } from "@/lib/connectors/fivetranAdapter";
import type { FivetranConnector } from "@/lib/connectors/fivetranAdapter";

import { Badge, formatIsoTime, Panel } from "./ui";

type Props = {
  connectors: FivetranConnector[] | null;
};

function healthTone(health: FivetranConnector["health"]): "success" | "warning" | "danger" {
  if (health === "healthy") return "success";
  if (health === "warning") return "warning";
  return "danger";
}

export function FivetranConnectorPanel({ connectors }: Props) {
  return (
    <Panel title="Fivetran connectors" step={2}>
      <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-950">
        <Cable className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
        <p>{FIVETRAN_DEMO_NARRATIVE}</p>
      </div>

      {!connectors ? (
        <p className="text-sm text-slate-500">Run a scan to load connector status.</p>
      ) : (
        <ul className="space-y-3">
          {connectors.map((connector) => (
            <li
              key={connector.id}
              className={`rounded-lg border p-4 ${
                connector.health === "warning"
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{connector.name}</p>
                  <p className="text-xs text-slate-500">{connector.source} → {connector.destination}</p>
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
      )}
    </Panel>
  );
}
