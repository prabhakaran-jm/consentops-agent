import type { DataSpreadMap } from "@/lib/warehouse/localWarehouse";
import type { DataMatch } from "@/lib/warehouse/types";
import { MATCH_FIELDS } from "@/lib/warehouse/types";

import { Badge, Panel } from "./ui";

type Props = {
  spreadMap: Partial<DataSpreadMap> | null;
  matches: DataMatch[] | null;
  beforeCount: number | null;
};

function countIdentifierTypes(matches: DataMatch[]) {
  let withDirect = 0;
  let withHashedEmail = 0;
  for (const match of matches) {
    const hasDirect =
      match.matchedFields.includes(MATCH_FIELDS.email) ||
      match.matchedFields.includes(MATCH_FIELDS.phone) ||
      match.matchedFields.includes(MATCH_FIELDS.customerId);
    const hasHashed = match.matchedFields.includes(MATCH_FIELDS.emailSha256);
    if (hasDirect) withDirect += 1;
    if (hasHashed) withHashedEmail += 1;
  }
  return { withDirect, withHashedEmail };
}

export function DataSpreadMapPanel({ spreadMap, matches, beforeCount }: Props) {
  if (!spreadMap || !matches || beforeCount === null) {
    return (
      <Panel title="Data spread map" step={3}>
        <p className="text-sm text-slate-500">Run a scan to see where subject data appears.</p>
      </Panel>
    );
  }

  const { withDirect, withHashedEmail } = countIdentifierTypes(matches);
  const entries = Object.entries(spreadMap).filter(([, row]) => row && row.totalMatches > 0);

  let highTotal = 0;
  let mediumTotal = 0;
  for (const [, row] of entries) {
    if (!row) continue;
    highTotal += row.highConfidenceMatches;
    mediumTotal += row.mediumConfidenceMatches;
  }

  const showMedium = mediumTotal > 0;

  return (
    <Panel title="Data spread map" step={3}>
      <p className="text-sm text-slate-600">
        {withDirect} records with direct identifiers and {withHashedEmail} records also matched by
        hashed email. These categories can overlap and do not need to sum to {beforeCount} total
        records.
      </p>

      <div className="flex flex-wrap gap-2">
        <Badge tone="info">{beforeCount} records found</Badge>
        <Badge tone="neutral">{withDirect} records with direct identifiers</Badge>
        <Badge tone="neutral">{withHashedEmail} records also matched by hashed email</Badge>
        <Badge tone="success">{highTotal} high confidence</Badge>
        {showMedium && <Badge tone="warning">{mediumTotal} medium confidence</Badge>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Table</th>
              <th className="px-4 py-2">Matches</th>
              <th className="px-4 py-2">Direct</th>
              <th className="px-4 py-2">Hashed email</th>
              <th className="px-4 py-2">High</th>
              {showMedium && <th className="px-4 py-2">Medium</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(([table, row]) => (
              <tr key={table}>
                <td className="px-4 py-2 font-mono text-slate-800">{table}</td>
                <td className="px-4 py-2">{row!.totalMatches}</td>
                <td className="px-4 py-2">{row!.directIdentifierMatches}</td>
                <td className="px-4 py-2">{row!.derivedIdentifierMatches}</td>
                <td className="px-4 py-2">{row!.highConfidenceMatches}</td>
                {showMedium && <td className="px-4 py-2">{row!.mediumConfidenceMatches}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
