"use client";

import { useState } from "react";
import { Copy, FileJson, FileText } from "lucide-react";

import {
  formatAuditReportJson,
  formatAuditReportMarkdown,
  LIVE_RESCAN_NOTE,
  type ConsentOpsAuditReport,
} from "@/lib/audit/auditReport";

import { Badge, formatIsoTime, Panel } from "./ui";

type Props = {
  audit: ConsentOpsAuditReport | null;
  pending: boolean;
};

export function AuditReportPanel({ audit, pending }: Props) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const json = audit ? formatAuditReportJson(audit) : "";
  const markdown = audit ? formatAuditReportMarkdown(audit) : "";

  const copyText = async (text: string, kind: "json" | "markdown") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (kind === "json") {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    }
  };

  return (
    <Panel title="Audit report" step={6}>
      {pending && !audit && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <FileJson className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 font-medium text-slate-700">No execution yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Approve and execute cleanup to generate a demo audit report for this plan.
          </p>
        </div>
      )}

      {audit && (
        <>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {audit.summary}
          </p>
          <p className="text-xs text-slate-500">{audit.disclaimer}</p>

          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Before: {audit.recordsFoundBefore}</Badge>
            <Badge tone="info">After (live re-scan): {audit.recordsRemainingAfter}</Badge>
            <Badge tone="success">Retained: {audit.retainedRecordsWithReasons.length}</Badge>
            <Badge tone="info">{audit.verificationResult.statusLabel}</Badge>
            {audit.verificationResult.noMatchGrowth && (
              <Badge tone="success">No match growth after cleanup</Badge>
            )}
          </div>
          <p className="text-sm text-slate-600">{LIVE_RESCAN_NOTE}</p>
          <p className="text-sm text-slate-500">{audit.verificationResult.message}</p>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Generated</dt>
              <dd>{formatIsoTime(audit.generatedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Request type</dt>
              <dd>{audit.requestType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approved by</dt>
              <dd>{audit.approval.approvedBy}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Approval ID</dt>
              <dd className="font-mono text-xs">{audit.approval.approvalId}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Connectors inspected</dt>
              <dd>{audit.connectorsInspected.map((c) => c.name).join(", ")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Tables scanned</dt>
              <dd className="font-mono text-xs">{audit.warehouseTablesScanned.join(", ")}</dd>
            </div>
          </dl>

          {audit.retainedRecordsWithReasons.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-800">Retained records</p>
              <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-slate-600">
                {audit.retainedRecordsWithReasons.map((r) => (
                  <li key={r.actionId}>
                    {r.table} — {r.recordIds.join(", ")} — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(json, "json")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copiedJson ? "JSON copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => copyText(markdown, "markdown")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" aria-hidden />
              {copiedMarkdown ? "Markdown copied" : "Copy markdown"}
            </button>
          </div>

          <details className="rounded-lg border border-slate-200">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700">
              Preview JSON
            </summary>
            <pre className="max-h-64 overflow-auto border-t border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
              {json}
            </pre>
          </details>
        </>
      )}
    </Panel>
  );
}
