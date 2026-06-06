"use client";

import { useState } from "react";
import { Copy, FileJson, FileText } from "lucide-react";

import {
  formatAuditReportJson,
  formatAuditReportMarkdown,
  LIVE_RESCAN_NOTE,
  type ConsentOpsAuditReport,
} from "@/lib/audit/auditReport";

import { Badge, formatIsoTime, StepPanel } from "./ui";

type Props = {
  audit: ConsentOpsAuditReport | null;
  pending: boolean;
};

function retentionTag(reason: string): { label: string; tone: "neutral" | "info" } {
  const lower = reason.toLowerCase();
  if (lower.includes("legal") || lower.includes("tax") || lower.includes("financial")) {
    return { label: "Financial / legal hold", tone: "neutral" };
  }
  if (lower.includes("sec") || lower.includes("security") || lower.includes("audit")) {
    return { label: "Sec compliance", tone: "info" };
  }
  return { label: "Policy retain", tone: "neutral" };
}

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
    <StepPanel id="step-6" step={6} title="Audit Report Generated" dimmed={pending && !audit}>
      {pending && !audit && (
        <div className="rounded-lg border border-dashed border-cops-outline-variant bg-cops-surface-container-low p-8 text-center">
          <FileJson className="mx-auto h-8 w-8 text-cops-outline" aria-hidden />
          <p className="mt-2 font-medium text-cops-primary">Locked until execution</p>
          <p className="mt-1 text-[13px] text-cops-on-surface-variant">
            Approve and slide to execute cleanup to generate the demo audit report.
          </p>
        </div>
      )}

      {audit && (
        <div className="space-y-6">
          <p className="rounded-lg border border-cops-outline-variant bg-cops-surface-container-low p-3 text-[13px] text-cops-on-surface">
            {audit.summary}
          </p>

          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Before: {audit.recordsFoundBefore}</Badge>
            <Badge tone="info">After re-scan: {audit.recordsRemainingAfter}</Badge>
            <Badge tone="success">Retained: {audit.retainedRecordsWithReasons.length}</Badge>
            <Badge tone="info">{audit.verificationResult.statusLabel}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded border border-cops-outline-variant bg-cops-surface-container-low p-4">
              <h4 className="mb-4 border-b border-cops-outline-variant pb-2 text-sm font-semibold">
                Retained records analysis
              </h4>
              {audit.retainedRecordsWithReasons.length === 0 ? (
                <p className="text-[13px] text-cops-on-surface-variant">No retained records in this execution.</p>
              ) : (
                <ul className="space-y-3">
                  {audit.retainedRecordsWithReasons.map((r) => {
                    const tag = retentionTag(r.reason);
                    return (
                      <li
                        key={r.actionId}
                        className="flex items-center justify-between rounded border border-cops-outline-variant bg-cops-surface-container-lowest p-2 text-[13px]"
                      >
                        <span className="font-mono">
                          {r.table} ({r.recordIds.length})
                        </span>
                        <Badge tone={tag.tone}>{tag.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <dl className="grid gap-3 text-[13px]">
              <div>
                <dt className="text-cops-on-surface-variant">Generated</dt>
                <dd>{formatIsoTime(audit.generatedAt)}</dd>
              </div>
              <div>
                <dt className="text-cops-on-surface-variant">Approved by</dt>
                <dd>{audit.approval.approvedBy}</dd>
              </div>
              <div>
                <dt className="text-cops-on-surface-variant">Tables scanned</dt>
                <dd className="font-mono text-xs">{audit.warehouseTablesScanned.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-cops-on-surface-variant">Verification</dt>
                <dd>{audit.verificationResult.message}</dd>
              </div>
            </dl>
          </div>

          <p className="text-[13px] text-cops-on-surface-variant">{LIVE_RESCAN_NOTE}</p>
          <p className="text-xs text-cops-outline">{audit.disclaimer}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(json, "json")}
              className="inline-flex items-center gap-2 rounded-lg border border-cops-outline-variant px-3 py-2 text-sm font-medium hover:bg-cops-surface-container-low"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copiedJson ? "JSON copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => copyText(markdown, "markdown")}
              className="inline-flex items-center gap-2 rounded-lg border border-cops-outline-variant px-3 py-2 text-sm font-medium hover:bg-cops-surface-container-low"
            >
              <FileText className="h-4 w-4" aria-hidden />
              {copiedMarkdown ? "Markdown copied" : "Copy markdown"}
            </button>
          </div>

          <details className="rounded-lg border border-cops-outline-variant">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-cops-primary">
              Preview JSON audit
            </summary>
            <pre className="max-h-64 overflow-auto border-t border-cops-outline-variant bg-cops-primary-container p-4 font-mono text-xs text-cops-inverse-on-surface">
              {json}
            </pre>
          </details>
        </div>
      )}
    </StepPanel>
  );
}
