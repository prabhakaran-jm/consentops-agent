import { CheckCircle } from "lucide-react";

import type { DataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type { DataMatch } from "@/lib/warehouse/types";

import { Badge, DensityBar, StepPanel } from "./ui";

type Props = {
  spreadMap: Partial<DataSpreadMap> | null;
  matches: DataMatch[] | null;
  beforeCount: number | null;
  planReady?: boolean;
};

function tableStatus(total: number, high: number, medium: number): { label: string; tone: "success" | "warning" | "neutral" } {
  if (total === 0) return { label: "Clear", tone: "neutral" };
  if (medium > high) return { label: "Warning", tone: "warning" };
  return { label: "Healthy", tone: "success" };
}

export function DataSpreadMapPanel({
  spreadMap,
  matches,
  beforeCount,
  planReady = false,
}: Props) {
  if (!spreadMap || !matches || beforeCount === null) {
    return (
      <StepPanel id="step-3" step={3} title="Data Spread Map">
        <p className="text-[13px] text-cops-on-surface-variant">Run a scan to see where subject data appears.</p>
      </StepPanel>
    );
  }

  const entries = Object.entries(spreadMap).sort((a, b) => (b[1]?.totalMatches ?? 0) - (a[1]?.totalMatches ?? 0));
  const maxMatches = Math.max(...entries.map(([, row]) => row?.totalMatches ?? 0), 1);
  const tablesWithData = entries.filter(([, row]) => (row?.totalMatches ?? 0) > 0).length;

  return (
    <StepPanel
      id="step-3"
      step={3}
      title="Data Spread Map"
      bodyClassName="p-0"
      headerRight={
        <Badge tone="success">
          <CheckCircle className="mr-1 inline h-3 w-3" aria-hidden />
          Scan Complete
        </Badge>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="border-b border-cops-outline-variant bg-cops-surface font-mono text-[11px] uppercase tracking-wider text-cops-outline">
            <tr>
              <th className="px-6 py-3 font-medium">Warehouse table</th>
              <th className="px-6 py-3 font-medium">Records</th>
              <th className="px-6 py-3 font-medium">Density</th>
              <th className="px-6 py-3 font-medium">Confidence</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cops-outline-variant">
            {entries.map(([table, row]) => {
              if (!row) return null;
              const status = tableStatus(row.totalMatches, row.highConfidenceMatches, row.mediumConfidenceMatches);
              const warnRow = status.tone === "warning" && row.totalMatches > 0;
              return (
                <tr
                  key={table}
                  className={`transition-colors hover:bg-cops-surface-container-low ${
                    warnRow ? "bg-cops-error-container/20" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono font-medium text-cops-primary">{table}</span>
                  </td>
                  <td className={`px-6 py-4 font-mono ${warnRow ? "font-medium text-cops-error" : ""}`}>
                    {row.totalMatches} record{row.totalMatches === 1 ? "" : "s"}
                  </td>
                  <td className="px-6 py-4">
                    <DensityBar
                      value={row.totalMatches}
                      max={maxMatches}
                      tone={warnRow ? "error" : "secondary"}
                    />
                  </td>
                  <td className="px-6 py-4 font-mono text-cops-on-surface-variant">
                    {row.highConfidenceMatches}H / {row.mediumConfidenceMatches}M
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-start justify-between gap-3 border-t border-cops-outline-variant bg-cops-surface-container-low p-4 sm:flex-row sm:items-center">
        <p className="text-[13px] text-cops-on-surface-variant">
          Total instances found:{" "}
          <strong className="font-mono text-cops-primary">{beforeCount}</strong> across{" "}
          <strong className="font-mono text-cops-primary">{tablesWithData}</strong> tables.
          {!planReady ? (
            <>
              {" "}
              Continue to{" "}
              <a href="#step-4" className="font-medium text-cops-secondary hover:underline">
                Step 4
              </a>{" "}
              to generate a cleanup plan.
            </>
          ) : null}
        </p>
      </div>
    </StepPanel>
  );
}
