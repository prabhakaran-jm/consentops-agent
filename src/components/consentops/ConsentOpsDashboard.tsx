"use client";

import { useEffect, useState } from "react";

import { demoSubject } from "@/lib/demo/seedData";
import type { CleanupPlan, ConsentSubject } from "@/lib/warehouse/types";

import { ApprovalPanel } from "./ApprovalPanel";
import { AuditReportPanel } from "./AuditReportPanel";
import { CleanupPlanPanel } from "./CleanupPlanPanel";
import { DataSpreadMapPanel } from "./DataSpreadMapPanel";
import { DeletionRequestCard } from "./DeletionRequestCard";
import { FivetranConnectorPanel } from "./FivetranConnectorPanel";
import type { AuditResponse, ExecuteResponse, PlanResponse, ScanResponse } from "./types";

export function ConsentOpsDashboard() {
  const [subject] = useState<ConsentSubject>(demoSubject);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<AuditResponse>({
    status: "no_execution_yet",
    audit: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [executionCompleted, setExecutionCompleted] = useState(false);

  const refreshAudit = async () => {
    const res = await fetch("/api/audit");
    if (!res.ok) return;
    const data = (await res.json()) as AuditResponse;
    setAudit(data);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/audit");
      if (!res.ok || !active) return;
      const data = (await res.json()) as AuditResponse;
      setAudit(data);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleScan = async () => {
    setError(null);
    setLoadingScan(true);
    try {
      const res = await fetch("/api/scan");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Scan failed");
      }
      const data = (await res.json()) as ScanResponse;
      setScan(data);
      setPlan(null);
      setSelectedIds(new Set());
      setExecutionCompleted(false);
      await refreshAudit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoadingScan(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!scan) return;
    setError(null);
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: scan.matches }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? body.message ?? "Plan generation failed");
      }
      const data = (await res.json()) as PlanResponse;
      setPlan(data.plan);
      setSelectedIds(new Set());
      setExecutionCompleted(false);
      setAudit({ status: "no_execution_yet", audit: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleExecute = async () => {
    if (executionCompleted || !plan || selectedIds.size === 0) return;
    setError(null);
    setLoadingExecute(true);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: `approval_${Date.now()}`,
          approvedActionIds: [...selectedIds],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? "Execution failed");
      }
      const data = body as ExecuteResponse;
      setAudit({ status: "ok", audit: data.audit });
      setSelectedIds(new Set());
      setExecutionCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed");
    } finally {
      setLoadingExecute(false);
    }
  };

  const toggleAction = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!plan) return;
    setSelectedIds(new Set(plan.actions.map((a) => a.id)));
  };

  const auditPending = audit.status === "no_execution_yet";
  const auditReport = audit.status === "ok" ? audit.audit : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2 border-b border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Hackathon demo · synthetic data only
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          ConsentOps Agent
        </h1>
        <p className="max-w-2xl text-slate-600">
          Trace personal data across pipelines, approve cleanup, and produce a demo audit report.
        </p>
      </header>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <DeletionRequestCard
          subject={subject}
          onScan={handleScan}
          loading={loadingScan}
          scanned={Boolean(scan)}
        />
        <FivetranConnectorPanel connectors={scan?.connectors ?? null} />
      </div>

      <DataSpreadMapPanel
        spreadMap={scan?.spreadMap ?? null}
        matches={scan?.matches ?? null}
        beforeCount={scan?.beforeCount ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CleanupPlanPanel
          plan={plan}
          onGenerate={handleGeneratePlan}
          loading={loadingPlan}
          canGenerate={Boolean(scan)}
        />
        <ApprovalPanel
          plan={plan}
          selectedIds={selectedIds}
          onToggle={toggleAction}
          onSelectAll={selectAll}
          onClear={() => setSelectedIds(new Set())}
          onExecute={handleExecute}
          loading={loadingExecute}
          executionCompleted={executionCompleted}
        />
      </div>

      <AuditReportPanel audit={auditReport} pending={auditPending} />
    </div>
  );
}
