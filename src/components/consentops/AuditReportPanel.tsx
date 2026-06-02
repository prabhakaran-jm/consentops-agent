"use client";

import { useState } from "react";
import { Copy, FileJson } from "lucide-react";

import type { AuditReport } from "@/lib/warehouse/types";

import { Badge, formatIsoTime, Panel } from "./ui";

type Props = {
  audit: AuditReport | null;
  pending: boolean;
  beforeCount: number | null;
  afterCount: number | null;
};

export function AuditReportPanel({ audit, pending, beforeCount, afterCount }: Props) {
  const [copied, setCopied] = useState(false);

  const json = audit ? JSON.stringify(audit, null, 2) : "";

  const copyJson = async () => {
    if (!json) return;
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Panel title="Audit report" step={6}>
      {pending && !audit && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <FileJson className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 font-medium text-slate-700">No execution yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Approve and execute cleanup to generate an audit report for this plan.
          </p>
        </div>
      )}

      {audit && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">
              Before cleanup: {audit.totalMatchesBeforeCleanup} matches
            </Badge>
            <Badge tone="info">
              After = live re-scan: {afterCount ?? audit.remainingMatchesAfterCleanup} matches
            </Badge>
            <Badge tone="success">Retained: {audit.retainedRecords.length}</Badge>
          </div>
          <p className="text-sm text-slate-600">
            After cleanup, ConsentOps re-scans the demo warehouse instead of trusting a
            self-reported count. The &quot;After&quot; number is whatever the scanner still finds.
          </p>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Generated</dt>
              <dd>{formatIsoTime(audit.generatedAtIso)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approved by</dt>
              <dd>{audit.approvedBy}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Notes</dt>
              <dd className="text-slate-700">{audit.notes}</dd>
            </div>
          </dl>

          {audit.retainedRecords.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-800">Retained records</p>
              <ul className="mt-1 max-h-32 overflow-y-auto text-xs font-mono text-slate-600">
                {audit.retainedRecords.map((r) => (
                  <li key={r.id}>
                    {r.table} — {r.recordIds.join(", ")}
                    {r.retainReason ? ` (${r.retainReason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>

          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
            {json}
          </pre>
        </>
      )}

      {!pending && !audit && beforeCount !== null && (
        <p className="text-sm text-slate-500">Waiting for execution.</p>
      )}
    </Panel>
  );
}
